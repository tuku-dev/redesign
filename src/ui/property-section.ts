export function propertySection(area: HTMLElement, title: string): HTMLDivElement {
  const section = document.createElement('details');
  section.className = 'property-group';
  section.open = true;
  const summary = document.createElement('summary');
  const heading = document.createElement('h3');
  heading.textContent = title;
  summary.append(heading);
  const content = document.createElement('div');
  content.className = 'property-section-content';
  section.append(summary, content);
  area.append(section);
  return content;
}
