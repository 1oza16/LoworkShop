import threading
from queue import Queue


CHANNELS = frozenset({"album", "database", "sheets", "statistics"})


class EventManager:
    def __init__(self):
        self._subscribers: dict[str, set[Queue[str]]] = {}
        self._lock = threading.Lock()

    def subscribe(self, channel: str) -> Queue[str]:
        subscriber = Queue()
        with self._lock:
            self._subscribers.setdefault(channel, set()).add(subscriber)
        return subscriber

    def unsubscribe(self, channel: str, subscriber: Queue[str]) -> None:
        with self._lock:
            subscribers = self._subscribers.get(channel)
            if subscribers is None:
                return

            subscribers.discard(subscriber)
            if not subscribers:
                self._subscribers.pop(channel)

    def notify(self, channel: str, event_name: str = "update") -> None:
        with self._lock:
            for subscriber in self._subscribers.get(channel, ()):
                subscriber.put(event_name)


EVENT_MANAGER = EventManager()