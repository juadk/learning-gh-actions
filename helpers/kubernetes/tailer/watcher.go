package tailer

import (
	"context"
	"fmt"
	"regexp"

	"github.com/epinio/epinio/helpers/tracelog"
	"github.com/pkg/errors"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/watch"
	v1 "k8s.io/client-go/kubernetes/typed/core/v1"
)

// Target is a thing to watch the logs of. It is specified by namespace, pod, and container
type Target struct {
	Namespace string
	Pod       string
	Container string
}

// GetID returns the ID of the object
func (t *Target) GetID() string {
	return fmt.Sprintf("%s-%s-%s", t.Namespace, t.Pod, t.Container)
}

// Watch starts listening to Kubernetes events and emits modified
// containers/pods. The first result is targets added, the second is targets
// removed
func Watch(ctx context.Context, i v1.PodInterface, podFilter *regexp.Regexp,
	containerFilter *regexp.Regexp, containerExcludeFilter *regexp.Regexp,
	containerState ContainerState, labelSelector labels.Selector) (chan *Target, chan *Target, error) {

	logger := tracelog.NewLogger().WithName("pod-watch").V(4)

	logger.Info("create")
	watcher, err := i.Watch(ctx, metav1.ListOptions{Watch: true, LabelSelector: labelSelector.String()})
	if err != nil {
		fmt.Printf("err.Error() = %+v\n", err.Error())
		return nil, nil, errors.Wrap(err, "failed to set up watch")
	}

	added := make(chan *Target)
	removed := make(chan *Target)

	go func() {
		logger.Info("await events")
		defer func() {
			logger.Info("event processing ends")
		}()
		for {
			select {
			case e := <-watcher.ResultChan():
				logger.Info("received event")

				if e.Object == nil {
					logger.Info("event error, no object")
					// Closed because of error
					return
				}

				pod, ok := e.Object.(*corev1.Pod)
				if !ok {
					logger.Info("event error, object not a pod")
					// Not a Pod
					return
				}

				if !podFilter.MatchString(pod.Name) {
					logger.Info("filtered", "pod", pod.Name, "filter", podFilter.String())
					continue
				}

				switch e.Type {
				case watch.Added, watch.Modified:
					logger.Info("pod added/modified", "name", pod.Name)

					var statuses []corev1.ContainerStatus
					statuses = append(statuses, pod.Status.InitContainerStatuses...)
					statuses = append(statuses, pod.Status.ContainerStatuses...)

					for _, c := range statuses {
						if !containerFilter.MatchString(c.Name) {
							logger.Info("filtered", "container", c.Name, "filter", containerFilter.String())
							continue
						}
						if containerExcludeFilter != nil && containerExcludeFilter.MatchString(c.Name) {
							logger.Info("excluded", "container", c.Name, "exclude-filter", containerExcludeFilter.String())
							continue
						}

						if containerState.Match(c.State) {
							logger.Info("report added", "container", c.Name, "pod", pod.Name, "namespace", pod.Namespace)
							added <- &Target{
								Namespace: pod.Namespace,
								Pod:       pod.Name,
								Container: c.Name,
							}
						}

						logger.Info("state mismatch", "container", c.Name, "pod", pod.Name, "namespace", pod.Namespace, "actual", c.State, "desired", containerState)
					}
				case watch.Deleted:
					logger.Info("pod deleted", "name", pod.Name)

					var containers []corev1.Container
					containers = append(containers, pod.Spec.Containers...)
					containers = append(containers, pod.Spec.InitContainers...)

					for _, c := range containers {
						if !containerFilter.MatchString(c.Name) {
							logger.Info("filtered", "container", c.Name, "filter", containerFilter.String())
							continue
						}
						if containerExcludeFilter != nil && containerExcludeFilter.MatchString(c.Name) {
							logger.Info("excluded", "container", c.Name, "exclude-filter", containerExcludeFilter.String())
							continue
						}

						logger.Info("report removed", "container", c.Name, "pod", pod.Name, "namespace", pod.Namespace)
						removed <- &Target{
							Namespace: pod.Namespace,
							Pod:       pod.Name,
							Container: c.Name,
						}
					}
				}
			case <-ctx.Done():
				logger.Info("received stop request")
				watcher.Stop()
				close(added)
				close(removed)
				return
			}
		}
	}()

	logger.Info("pass watch report channels")
	return added, removed, nil
}
