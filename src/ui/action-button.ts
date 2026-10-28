import { createIcon } from './icons.ts';
import type { IconName } from './icons.ts';
export function actionButton(label: string, icon: IconName, action: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.append(createIcon(icon), document.createTextNode(label));
  button.onclick = action;
  return button;
}
