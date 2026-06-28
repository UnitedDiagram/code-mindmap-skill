import { chromium } from 'playwright';
import path from 'path';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    headless: true
  });

  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const filePath = path.resolve('hermes-codebase-mindmap.html');
  await page.goto(`file://${filePath}`);
  await page.waitForTimeout(500);

  const nodeGroups = await page.locator('.node-group').count();
  console.log(`[Test 1] Initial node count: ${nodeGroups} (expected: 1) ${nodeGroups === 1 ? 'PASS' : 'FAIL'}`);

  const rootBreathing = await page.locator('.node-breathing').count();
  console.log(`[Test 2] Root breathing: ${rootBreathing > 0 ? 'PASS' : 'FAIL'}`);

  const legendHidden = await page.locator('#legend.visible').count();
  console.log(`[Test 3] Legend hidden: ${legendHidden === 0 ? 'PASS' : 'FAIL'}`);

  await page.screenshot({ path: '/tmp/claude-0/-home-user-code-mindmap-skill/d4a0528b-9a00-5484-b5a7-dba9cd825ad8/scratchpad/01-initial-state.png' });

  // Use JS to click nodes directly (avoids SVG coordinate issues)
  await page.evaluate(() => navigateToNode('root'));
  await page.waitForTimeout(600);
  // Root click should expand it showing 9 children. But navigateToNode expands the path, so
  // for root it just selects it. We need to click it via handleNodeClick.
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="root"]');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1000);

  const c1 = await page.locator('.node-group').count();
  console.log(`[Test 4] After root click: ${c1} nodes (expected: 10) ${c1 === 10 ? 'PASS' : 'FAIL'}`);

  await page.screenshot({ path: '/tmp/claude-0/-home-user-code-mindmap-skill/d4a0528b-9a00-5484-b5a7-dba9cd825ad8/scratchpad/02-first-expansion.png' });

  const legendVis = await page.locator('#legend.visible').count();
  console.log(`[Test 5] Legend visible: ${legendVis > 0 ? 'PASS' : 'FAIL'}`);

  const breathingStopped = await page.locator('.node-breathing').count();
  console.log(`[Test 6] Breathing stopped: ${breathingStopped === 0 ? 'PASS' : 'FAIL'}`);

  const rects = await page.locator('.node-rect').count();
  console.log(`[Test 7] Rectangles: ${rects > 0 ? 'PASS' : 'FAIL'} (${rects} rects, 0 circles)`);

  // Click Agent Core via JS dispatch
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="agent-core"]');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1000);

  const c2 = await page.locator('.node-group').count();
  console.log(`[Test 8] After Agent Core click: ${c2} nodes (expected: 18) ${c2 === 18 ? 'PASS' : 'FAIL'}`);

  await page.screenshot({ path: '/tmp/claude-0/-home-user-code-mindmap-skill/d4a0528b-9a00-5484-b5a7-dba9cd825ad8/scratchpad/03-second-expansion.png' });

  // Click Gateway (accordion: should collapse Agent Core children, expand Gateway children)
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="gateway"]');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1000);

  const c3 = await page.locator('.node-group').count();
  // root + 9 first-level + 5 gateway children = 15 (agent-core children collapsed)
  console.log(`[Test 9] Accordion (Gateway): ${c3} nodes (expected: 15) ${c3 === 15 ? 'PASS' : 'FAIL'}`);

  await page.screenshot({ path: '/tmp/claude-0/-home-user-code-mindmap-skill/d4a0528b-9a00-5484-b5a7-dba9cd825ad8/scratchpad/04-accordion.png' });

  // Collapse All
  await page.locator('#collapse-all').click();
  await page.waitForTimeout(600);

  const c4 = await page.locator('.node-group').count();
  console.log(`[Test 10] Collapse All: ${c4} nodes (expected: 1) ${c4 === 1 ? 'PASS' : 'FAIL'}`);

  // Expand All
  await page.locator('#expand-all').click();
  await page.waitForTimeout(600);

  const c5 = await page.locator('.node-group').count();
  console.log(`[Test 11] Expand All: ${c5} nodes (expected: 69) ${c5 === 69 ? 'PASS' : 'FAIL'}`);

  await page.screenshot({ path: '/tmp/claude-0/-home-user-code-mindmap-skill/d4a0528b-9a00-5484-b5a7-dba9cd825ad8/scratchpad/05-expand-all.png' });

  // Detail panel
  await page.locator('#collapse-all').click();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="root"]');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="agent-core"]');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(400);

  const detailTitle = await page.locator('#detail-content h2').textContent();
  console.log(`[Test 12] Detail panel: "${detailTitle}" ${detailTitle === 'Agent Core' ? 'PASS' : 'FAIL'}`);

  // Search
  await page.fill('#search-input', 'telegram');
  await page.waitForTimeout(300);
  const sr = await page.locator('#detail-content .connections li').count();
  console.log(`[Test 13] Search "telegram": ${sr} results ${sr > 0 ? 'PASS' : 'FAIL'}`);

  // Breadcrumb
  const breadcrumb = await page.locator('#breadcrumb').textContent();
  console.log(`[Test 14] Breadcrumb present: ${breadcrumb.length > 0 ? 'PASS' : 'FAIL'}`);

  console.log('\nDone!');
  await browser.close();
})().catch(err => {
  console.error('Test error:', err.message);
  process.exit(1);
});
