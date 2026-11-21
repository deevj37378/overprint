// The preview harness shell: a device frame around the real app pages, plus a control panel
// to fake the date, the user, the post, run moderator menu items and scheduler tasks, and see
// everything the app would have posted to Reddit.

type HarnessPost = {
  id: string;
  title: string;
  author: string;
  postData?: unknown;
};
type DevvitConfig = {
  menu?: { items?: { label: string; endpoint: string }[] };
  forms?: Record<string, string>;
  scheduler?: { tasks?: Record<string, string | { endpoint: string }> };
};

type HarnessState = {
  config: DevvitConfig;
  fakeDate: string | null;
  realDate: string;
  users: { id: string; name: string }[];
  userId: string;
  postId: string | null;
  posts: HarnessPost[];
  outbox: { at: number; kind: string; detail: string }[];
  actions?: { id: string; label: string }[];
};

type FormField = {
  type: string;
  name: string;
  label?: string;
  helpText?: string;
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
};

type DeviceId = 'phone' | 'feed' | 'tablet' | 'desktop';
const DEVICE_IDS: DeviceId[] = ['phone', 'feed', 'tablet', 'desktop'];
const DEVICES: Record<
  DeviceId,
  { w: number; h: number; label: string; feed: boolean }
> = {
  phone: { w: 390, h: 844, label: 'Phone 390×844', feed: false },
  feed: { w: 390, h: 512, label: 'Feed card (inline) 390×512', feed: true },
  tablet: { w: 768, h: 1024, label: 'Tablet 768×1024', feed: false },
  desktop: { w: 1440, h: 900, label: 'Desktop 1440×900', feed: false },
};

const PAGES: Record<string, string> = {
  splash: 'splash.html',
  game: 'game.html',
  shop: 'shop.html',
  gallery: 'gallery.html',
};

const params = new URLSearchParams(location.search);
const isDevice = (value: string | null): value is DeviceId =>
  DEVICE_IDS.some((id) => id === value);
const deviceParam = params.get('device');
let device: DeviceId = isDevice(deviceParam) ? deviceParam : 'phone';
let page = params.get('page') ?? 'splash';
let state: HarnessState | null = null;

const $ = <T extends HTMLElement>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing ${selector}`);
  return el;
};

const api = async (route: string, body?: unknown): Promise<HarnessState> => {
  const res = await fetch(`/__preview${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.json();
};

const toast = (text: string) => {
  const el = document.createElement('div');
  el.textContent = text;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 3000);
};

const pageForEntry = (entry: string): string =>
  entry === 'default' ? 'splash' : entry in PAGES ? entry : 'splash';

const loadFrame = () => {
  const frame = $<HTMLIFrameElement>('#app');
  const d = DEVICES[device];
  const effectivePage = device === 'feed' ? 'splash' : page;
  frame.src = `/src/client/${PAGES[effectivePage] ?? 'splash.html'}?t=${Date.now()}`;
  frame.width = String(d.w);
  frame.height = String(d.h);
  $('#device').classList.toggle('feed', d.feed);
  const stage = $('#stage');
  const scale = Math.min(1, (stage.clientWidth - 48) / (d.w + 20));
  $('#device').style.transform = scale < 1 ? `scale(${scale})` : '';
  $('#device-label').textContent =
    `${d.label} · ${effectivePage}${scale < 1 ? ` · shown at ${Math.round(scale * 100)}%` : ''}`;
};

const runInternal = async (endpoint: string, payload?: unknown) => {
  const res = await fetch('/__preview/internal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint, payload }),
  });
  const out: { status: number; body: Record<string, unknown> | null } =
    await res.json();
  const body = out.body ?? {};
  if (typeof body.showToast === 'string') toast(body.showToast);
  else if (
    typeof body.showToast === 'object' &&
    body.showToast &&
    'text' in body.showToast
  ) {
    toast(String(body.showToast.text));
  }
  if (typeof body.navigateTo === 'string')
    toast(`Would open ${body.navigateTo}`);
  const showForm = body.showForm;
  if (
    showForm &&
    typeof showForm === 'object' &&
    'name' in showForm &&
    'form' in showForm
  ) {
    const values = await askForm(showForm.form);
    const formName = String(showForm.name);
    const formEndpoint = state?.config.forms?.[formName];
    if (values && formEndpoint) await runInternal(formEndpoint, values);
  }
  await refresh(true);
};

const askForm = (
  formValue: unknown
): Promise<Record<string, unknown> | null> => {
  const form =
    typeof formValue === 'object' && formValue !== null ? formValue : {};
  const title = 'title' in form ? String(form.title) : 'Form';
  const fields: FormField[] =
    'fields' in form && Array.isArray(form.fields) ? form.fields : [];
  const dialog = $<HTMLDialogElement>('#form-dialog');
  dialog.innerHTML = '';
  const el = document.createElement('form');
  el.method = 'dialog';
  const heading = document.createElement('h3');
  heading.textContent = title;
  el.append(heading);
  for (const field of fields) {
    const label = document.createElement('label');
    label.textContent = field.label ?? field.name;
    el.append(label);
    let input: HTMLInputElement | HTMLSelectElement;
    if (field.type === 'select') {
      input = document.createElement('select');
      for (const option of field.options ?? []) {
        const o = document.createElement('option');
        o.value = option.value;
        o.textContent = option.label;
        input.append(o);
      }
    } else {
      input = document.createElement('input');
      input.type =
        field.type === 'number'
          ? 'number'
          : field.type === 'boolean'
            ? 'checkbox'
            : 'text';
      if (field.defaultValue !== undefined)
        input.value = String(field.defaultValue);
    }
    input.name = field.name;
    el.append(input);
    if (field.helpText) {
      const help = document.createElement('div');
      help.className = 'help';
      help.textContent = field.helpText;
      el.append(help);
    }
  }
  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.innerHTML = `<button value="cancel">Cancel</button><button value="ok">OK</button>`;
  el.append(actions);
  dialog.append(el);
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener(
      'close',
      () => {
        if (dialog.returnValue !== 'ok') return resolve(null);
        const values: Record<string, unknown> = {};
        for (const field of fields) {
          const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(
            `[name="${field.name}"]`
          );
          if (!input) continue;
          if (field.type === 'select') values[field.name] = [input.value];
          else if (field.type === 'number')
            values[field.name] = Number(input.value);
          else if (
            field.type === 'boolean' &&
            input instanceof HTMLInputElement
          )
            values[field.name] = input.checked;
          else values[field.name] = input.value;
        }
        resolve(values);
      },
      { once: true }
    );
  });
};

const button = (
  label: string,
  onClick: () => void,
  pressed?: boolean,
  cls?: string
) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
  if (cls) b.className = cls;
  b.addEventListener('click', onClick);
  return b;
};

const section = (title: string, ...children: Node[]) => {
  const s = document.createElement('section');
  const h = document.createElement('h2');
  h.textContent = title;
  s.append(h, ...children);
  return s;
};

const row = (...children: HTMLElement[]) => {
  const r = document.createElement('div');
  r.className = 'row';
  r.append(...children);
  return r;
};

const renderPanel = () => {
  if (!state) return;
  const s = state;
  const panel = $('#panel');
  panel.innerHTML =
    '<h1>Overprint · local preview</h1><p class="sub">Real server code, fake Reddit. Nothing leaves this machine.</p>';

  panel.append(
    section(
      'Page',
      row(
        ...Object.keys(PAGES).map((p) =>
          button(
            p,
            () => {
              page = p;
              renderPanel();
              loadFrame();
            },
            page === p
          )
        )
      )
    ),
    section(
      'Device',
      row(
        ...DEVICE_IDS.map((d) =>
          button(
            d,
            () => {
              device = d;
              renderPanel();
              loadFrame();
            },
            device === d
          )
        )
      )
    )
  );

  const date = document.createElement('input');
  date.type = 'date';
  date.value = s.fakeDate ?? s.realDate;
  date.addEventListener('change', async () => {
    state = await api('/state', {
      fakeDate: date.value === s.realDate ? '' : date.value,
    });
    renderPanel();
    loadFrame();
  });
  const dateLabel = document.createElement('label');
  dateLabel.textContent = s.fakeDate
    ? `Faked (real date ${s.realDate})`
    : 'Real date (UTC)';
  panel.append(
    section(
      'Server date',
      dateLabel,
      date,
      row(
        button('Real date', async () => {
          state = await api('/state', { fakeDate: '' });
          renderPanel();
          loadFrame();
        })
      )
    )
  );

  const user = document.createElement('select');
  for (const u of [
    ...s.users.map((x) => ({ id: x.id, label: `u/${x.name}` })),
    { id: 'out', label: 'Logged out' },
  ]) {
    const o = document.createElement('option');
    o.value = u.id;
    o.textContent = u.label;
    o.selected = u.id === s.userId;
    user.append(o);
  }
  user.addEventListener('change', async () => {
    state = await api('/state', { userId: user.value });
    renderPanel();
    loadFrame();
  });
  panel.append(section('Player', user));

  const post = document.createElement('select');
  for (const p of s.posts) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.title} — ${p.author}`;
    o.selected = p.id === s.postId;
    post.append(o);
  }
  post.addEventListener('change', async () => {
    state = await api('/state', { postId: post.value });
    renderPanel();
    loadFrame();
  });
  panel.append(
    section(
      'Post',
      s.posts.length ? post : document.createTextNode('No posts yet.')
    )
  );

  const menuItems = s.config.menu?.items ?? [];
  const tasks = s.config.scheduler?.tasks ?? {};
  panel.append(
    section(
      'Moderator & scheduler',
      row(
        ...menuItems.map((item) =>
          button(item.label, () => void runInternal(item.endpoint))
        ),
        ...Object.entries(tasks).map(([name, task]) =>
          button(`Run task: ${name}`, () => {
            const endpoint = typeof task === 'string' ? task : task.endpoint;
            void runInternal(endpoint, { name, data: {} });
          })
        )
      )
    )
  );

  panel.append(
    section(
      'Test helpers',
      row(
        ...(s.actions ?? []).map((a) =>
          button(a.label, async () => {
            state = await api('/action', { id: a.id });
            renderPanel();
            loadFrame();
          })
        ),
        button(
          'Reset all data',
          async () => {
            state = await api('/reset', {});
            renderPanel();
            loadFrame();
          },
          undefined,
          'danger'
        )
      )
    )
  );

  const outbox = document.createElement('ul');
  outbox.id = 'outbox';
  for (const item of s.outbox) {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = `${item.kind} · ${new Date(item.at).toLocaleTimeString()}`;
    li.append(b, document.createTextNode(item.detail));
    outbox.append(li);
  }
  panel.append(section('Outbox (what would happen on Reddit)', outbox));
};

const refresh = async (reloadFrame = false) => {
  state = await api('/state', {});
  renderPanel();
  if (reloadFrame) loadFrame();
};

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  const data = event.data;
  if (typeof data !== 'object' || data === null || !('opEffect' in data))
    return;
  const effect = data.opEffect;
  if (typeof effect !== 'object' || effect === null || !('type' in effect))
    return;
  const get = (key: string): string => {
    const value: unknown = Reflect.get(effect, key);
    return value === undefined ? '' : String(value);
  };
  switch (effect.type) {
    case 'expand':
      page = pageForEntry(get('entry'));
      if (device === 'feed') device = 'phone';
      renderPanel();
      loadFrame();
      break;
    case 'exit':
      page = 'splash';
      renderPanel();
      loadFrame();
      break;
    case 'toast':
      toast(get('text'));
      break;
    case 'navigate':
      toast(`Would open ${get('url')}`);
      break;
    case 'share':
      toast(`Share sheet: ${get('text')}`);
      break;
    case 'login':
      toast('Would show the Reddit log-in prompt');
      break;
    case 'form': {
      const id = get('id');
      void askForm('form' in effect ? effect.form : {}).then((values) => {
        $<HTMLIFrameElement>('#app').contentWindow?.postMessage(
          { opFormResult: true, id, values },
          '*'
        );
      });
      break;
    }
  }
  setTimeout(() => void refresh(false), 400);
});

window.addEventListener('resize', loadFrame);
setInterval(() => void refresh(false), 4000);
void refresh(true);
