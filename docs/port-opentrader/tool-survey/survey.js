/*
 * Phase 4 tool survey: every tool of the core specs in the runtime demo,
 * with real mouse / keyboard events (Playwright). Per tool:
 *   place   -> by its placement rule (clicks, press-drag for freehand,
 *              clicks + a click on the last point for variable length,
 *              addImage for the image); 1 drawing, point count
 *   select  -> deselect, then a real click on a body pixel (found with the
 *              runtime's own hit test) selects it
 *   anchor  -> real drag of the last anchor changes the drawing
 *   body    -> real drag of the selected body changes the drawing
 *   delete  -> Delete key removes it
 * plus a screenshot of the placed tool and the page errors.
 * Run: Playwright MCP browser_run_code_unsafe with this function body, the
 * demo served at http://localhost:3009/lightweight-charts-drawing/.
 */
async (page) => {
  const SHOTS = 'D:/projects/opentrader/.playwright-mcp/survey';
  await page.setViewportSize({ width: 1400, height: 800 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto('http://localhost:3009/lightweight-charts-drawing/');
  await page.waitForFunction(() => window.dm && window.lwcd, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  const box = await page.locator('#chart').boundingBox();
  const pane = await page.evaluate(() => { const s = window.chart.paneSize(0); return { w: s.width, h: s.height }; });
  const P = [[0.35, 0.35], [0.55, 0.55], [0.62, 0.4], [0.7, 0.6], [0.76, 0.45], [0.82, 0.62], [0.88, 0.5]].map(([fx, fy]) => ({ x: pane.w * fx, y: pane.h * fy }));
  const pg = (p) => ({ x: box.x + p.x, y: box.y + p.y });
  const specs = await page.evaluate(() => Object.values(window.lwcd.OVERLAY_SPECS).map((s) => ({ kind: s.kind, n: s.pointCount, variable: !!s.variableLength, freehand: !!s.freehand, text: !!s.textEditable })));
  // An image for the Image tool, in the core cache.
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 120; c.height = 80;
    const x = c.getContext('2d'); x.fillStyle = '#2962ff'; x.fillRect(0, 0, 120, 80); x.fillStyle = '#fff'; x.font = '20px sans-serif'; x.fillText('IMG', 38, 48);
    window.lwcd.cacheImage('survey.png', await window.lwcd.decodeImage(c.toDataURL('image/png')));
    window.autoText = 'Survey';
  });
  const state = (id) => page.evaluate((id) => { const d = window.dm.get(id); return d ? JSON.stringify({ p: d.points, s: d.style, i: d.image, a: d.anchored }) : null; }, id);
  // A body pixel of the drawing (runtime hit test on a 4 px grid), and a
  // pixel where nothing is hit.
  const findHit = (id) => page.evaluate(([id, w, h]) => {
    let handle = null;
    for (let y = 4; y < h - 4; y += 4) for (let x = 4; x < w - 4; x += 4) {
      const r = window.dm.hitTopmost({ x, y });
      if (r && r.drawing.id === id) { if (r.mode.hit === 'body') return { x, y, hit: 'body' }; handle = handle ?? { x, y, hit: 'handle' }; }
    }
    return handle;
  }, [id, pane.w, pane.h]);
  const findEmpty = () => page.evaluate(([w, h]) => {
    for (const [fx, fy] of [[0.05, 0.95], [0.05, 0.05], [0.95, 0.95], [0.5, 0.97], [0.02, 0.5]]) {
      const p = { x: w * fx, y: h * fy };
      if (!window.dm.hitTopmost(p)) return p;
    }
    return null;
  }, [pane.w, pane.h]);
  const anchorsOf = (id) => page.evaluate(([id, w, h]) => {
    const i = window.dm.drawings().findIndex((d) => d.id === id);
    const s = window.dm.scenes(w, h)[i];
    const a = s && s.scene.find((it) => it.t === 'anchors');
    return a ? a.pts : [];
  }, [id, pane.w, pane.h]);
  const drag = async (from, dx, dy) => {
    const a = pg(from);
    await page.mouse.move(a.x, a.y, { steps: 2 });
    await page.mouse.down();
    await page.mouse.move(a.x + dx, a.y + dy, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(30);
  };
  const rows = [];
  for (const s of specs) {
    const row = { kind: s.kind };
    const e0 = errors.length;
    try {
      await page.evaluate(() => { window.dm.clear(); window.dm.setTool(null); });
      await page.mouse.move(box.x + 2, box.y + 2);
      if (s.kind === 'image') {
        await page.evaluate(() => window.dm.addImage({ name: 'survey.png', width: 120, height: 80 }));
      } else {
        await page.evaluate(([k]) => window.dm.setTool(k, k === 'font-icon' ? { glyph: '★' } : {}), [s.kind]);
        if (s.freehand) {
          const a = pg(P[0]);
          await page.mouse.move(a.x, a.y); await page.mouse.down();
          for (let i = 1; i <= 24; i++) await page.mouse.move(a.x + i * 8, a.y + Math.sin(i / 3) * 30);
          await page.mouse.up();
        } else if (s.variable) {
          for (let i = 0; i < 4; i++) { const a = pg(P[i]); await page.mouse.move(a.x, a.y, { steps: 3 }); await page.mouse.click(a.x, a.y); }
          const a = pg(P[3]); await page.mouse.click(a.x, a.y);
        } else {
          for (let i = 0; i < s.n; i++) { const a = pg(P[i]); await page.mouse.move(a.x, a.y, { steps: 3 }); await page.mouse.click(a.x, a.y); }
        }
      }
      await page.waitForTimeout(60);
      const ds = await page.evaluate(() => window.dm.drawings().map((d) => ({ id: d.id, n: d.points.length })));
      row.placed = ds.length === 1 && ds[0].n >= 1 ? ds[0].n : `drawings ${ds.length}`;
      if (ds.length !== 1) { rows.push(row); continue; }
      const id = ds[0].id;
      row.tool = await page.evaluate(() => window.dm.tool());
      await page.mouse.move(box.x + 2, box.y + 2);
      await page.waitForTimeout(30);
      await page.screenshot({ path: `${SHOTS}/${s.kind}.png`, clip: { x: box.x, y: box.y, width: pane.w, height: pane.h } });
      // select by a real click on the body
      const empty = await findEmpty();
      if (empty) { const e = pg(empty); await page.mouse.click(e.x, e.y); }
      const deselected = (await page.evaluate(() => window.dm.selection().length)) === 0;
      const hit = await findHit(id);
      if (hit) { const h = pg(hit); await page.mouse.move(h.x, h.y, { steps: 2 }); await page.mouse.click(h.x, h.y); }
      row.select = deselected && hit ? ((await page.evaluate((id) => window.dm.selection().includes(id), id)) ? hit.hit : 'not selected') : hit ? 'no empty spot' : 'no hit pixel';
      // anchor drag (last anchor)
      const anchors = await anchorsOf(id);
      row.anchors = anchors.length;
      if (anchors.length) {
        const before = await state(id);
        await drag(anchors[anchors.length - 1], 25, 15);
        row.anchorDrag = (await state(id)) !== before ? 'moved' : 'unchanged';
      }
      // body drag (selected)
      const hit2 = await findHit(id);
      if (hit2 && hit2.hit === 'body') {
        await page.evaluate((id) => window.dm.select([id]), id);
        const before = await state(id);
        await drag(hit2, 30, 20);
        row.bodyDrag = (await state(id)) !== before ? 'moved' : 'unchanged';
      } else row.bodyDrag = 'no body pixel';
      // delete
      await page.evaluate((id) => window.dm.select([id]), id);
      await page.keyboard.press('Delete');
      row.deleted = (await page.evaluate(() => window.dm.drawings().length)) === 0;
    } catch (e) {
      row.error = String(e).slice(0, 160);
    }
    row.errors = errors.slice(e0);
    rows.push(row);
  }
  return rows;
}
