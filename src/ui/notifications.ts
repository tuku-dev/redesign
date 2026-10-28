export type Notify = (message: string) => void;
export function createNotifications(element: HTMLElement): Notify {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (message) => {
    element.textContent = message;
    element.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => (element.hidden = true), 4000);
  };
}
