/**
 * CollapsibleSection — the titled, collapsible chrome the prescribing screen
 * is built out of.
 */
import CollapsibleSection from '@/components/clinical-notes/prescribe/CollapsibleSection';
import { mount, click, q } from './test-utils';

describe('CollapsibleSection', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders children only while open', () => {
    const { container, unmount } = mount(
      <CollapsibleSection title="Drug Info" open={false} onToggle={jest.fn()}>
        <p>body content</p>
      </CollapsibleSection>,
    );
    expect(container.textContent).not.toContain('body content');
    expect(q(container, '.cn-rx-blocktoggle')!.getAttribute('aria-expanded')).toBe('false');
    unmount();
  });

  it('shows children and aria-expanded=true when open', () => {
    const { container, unmount } = mount(
      <CollapsibleSection title="Drug Info" open onToggle={jest.fn()}>
        <p>body content</p>
      </CollapsibleSection>,
    );
    expect(container.textContent).toContain('body content');
    expect(q(container, '.cn-rx-blocktoggle')!.getAttribute('aria-expanded')).toBe('true');
    unmount();
  });

  it('clicking the header toggle calls onToggle', () => {
    const onToggle = jest.fn();
    const { container, unmount } = mount(
      <CollapsibleSection title="Drug Info" open onToggle={onToggle}>
        <p>x</p>
      </CollapsibleSection>,
    );
    click(q(container, '.cn-rx-blocktoggle')!);
    expect(onToggle).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('renders the title and an optional aside', () => {
    const { container, unmount } = mount(
      <CollapsibleSection title="Pharmacy Info" open={false} onToggle={jest.fn()} aside={<span>3 items</span>}>
        <p>x</p>
      </CollapsibleSection>,
    );
    expect(container.textContent).toContain('Pharmacy Info');
    expect(container.textContent).toContain('3 items');
    unmount();
  });
});
