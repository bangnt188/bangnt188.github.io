(() => {
  const root = document.querySelector('[data-l3d]');
  if (!root) return;

  const scene = root.querySelector('[data-l3d-scene]');
  const floors = [...root.querySelectorAll('[data-l3d-floor]')];
  const controls = [...root.querySelectorAll('[data-l3d-select]')];
  const reset = root.querySelector('[data-l3d-reset]');
  const label = root.querySelector('[data-l3d-status]');

  let rx = -27;
  let ry = 34;
  let scale = 0.88;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const render = () => {
    scene.style.transform =
      `rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
  };

  const selectFloor = (value) => {
    const selected = value === 'all' ? null : String(value);

    floors.forEach((floor) => {
      const isActive = selected && floor.dataset.l3dFloor === selected;
      floor.classList.toggle('is-active', Boolean(isActive));
      floor.classList.toggle('is-muted', Boolean(selected && !isActive));
    });

    controls.forEach((control) => {
      control.classList.toggle('is-active', control.dataset.l3dSelect === (selected || 'all'));
    });

    if (label) {
      label.textContent = selected
        ? `Floor ${selected} selected`
        : 'Drag to rotate · scroll to zoom';
    }
  };

  root.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button') || event.target.closest('a')) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    root.classList.add('is-dragging');
    root.setPointerCapture?.(event.pointerId);
  });

  root.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    ry += dx * 0.34;
    rx = clamp(rx - dy * 0.26, -68, 8);
    lastX = event.clientX;
    lastY = event.clientY;
    render();
  });

  const stopDrag = () => {
    dragging = false;
    root.classList.remove('is-dragging');
  };

  root.addEventListener('pointerup', stopDrag);
  root.addEventListener('pointercancel', stopDrag);

  root.addEventListener('wheel', (event) => {
    event.preventDefault();
    scale = clamp(scale - event.deltaY * 0.0008, 0.58, 1.2);
    render();
  }, { passive: false });

  floors.forEach((floor) => {
    floor.addEventListener('click', (event) => {
      if (dragging) return;
      event.stopPropagation();
      selectFloor(floor.dataset.l3dFloor);
    });
  });

  controls.forEach((control) => {
    control.addEventListener('click', () => selectFloor(control.dataset.l3dSelect));
  });

  reset?.addEventListener('click', () => {
    rx = -27;
    ry = 34;
    scale = 0.88;
    selectFloor('all');
    render();
  });

  render();
})();