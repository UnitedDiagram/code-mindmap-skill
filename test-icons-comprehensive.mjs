import { chromium } from 'playwright';
import path from 'path';

const SCRATCHPAD = '/tmp/claude-0/-home-user-code-mindmap-skill/bc12f8df-9a5a-5a1c-9838-a9c217713b77/scratchpad';
let passed = 0, failed = 0, warnings = 0;

function log(name, pass, detail = '') {
  const status = pass ? 'PASS' : 'FAIL';
  if (pass) passed++; else failed++;
  console.log(`[${name}] ${status}${detail ? ' — ' + detail : ''}`);
}

function warn(name, detail) {
  warnings++;
  console.log(`[${name}] WARN — ${detail}`);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    headless: true
  });

  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  const filePath = path.resolve('hermes-codebase-mindmap.html');
  await page.goto(`file://${filePath}`);
  await page.waitForTimeout(500);

  // ===== SECTION 1: INITIAL STATE =====
  console.log('\n=== INITIAL STATE ===');

  const initNodes = await page.locator('.node-group').count();
  log('Init-NodeCount', initNodes === 1, `${initNodes} nodes`);

  const breathing = await page.locator('.node-breathing').count();
  log('Init-Breathing', breathing > 0, `${breathing} breathing nodes`);

  const legendHidden = await page.locator('#legend.visible').count();
  log('Init-LegendHidden', legendHidden === 0);

  const sidebarCollapsed = await page.locator('#sidebar.collapsed').count();
  log('Init-SidebarVisible', sidebarCollapsed === 0, 'sidebar should be visible initially');

  await page.screenshot({ path: `${SCRATCHPAD}/icon-01-initial.png` });

  // ===== SECTION 2: CONTROL BUTTON ICONS =====
  console.log('\n=== CONTROL BUTTON ICONS ===');

  // -- Expand All Button --
  await page.locator('#expand-all').click();
  await page.waitForTimeout(800);

  const expandedCount = await page.locator('.node-group').count();
  log('ExpandAll-NodeCount', expandedCount === 69, `${expandedCount} nodes (expected 69)`);

  const legendAfterExpand = await page.locator('#legend.visible').count();
  log('ExpandAll-LegendShown', legendAfterExpand > 0);

  const breathingAfterExpand = await page.locator('.node-breathing').count();
  log('ExpandAll-NoBreathing', breathingAfterExpand === 0, `${breathingAfterExpand} breathing nodes`);

  await page.screenshot({ path: `${SCRATCHPAD}/icon-02-expand-all.png` });

  // -- Collapse All Button --
  await page.locator('#collapse-all').click();
  await page.waitForTimeout(800);

  const collapsedCount = await page.locator('.node-group').count();
  log('CollapseAll-NodeCount', collapsedCount === 1, `${collapsedCount} nodes (expected 1)`);

  const breathingAfterCollapse = await page.locator('.node-breathing').count();
  log('CollapseAll-BreathingRestored', breathingAfterCollapse > 0, `${breathingAfterCollapse} breathing nodes`);

  await page.screenshot({ path: `${SCRATCHPAD}/icon-03-collapse-all.png` });

  // -- Zoom In Button --
  const transformBefore = await page.evaluate(() => currentTransform.k);
  await page.locator('#zoom-in').click();
  await page.waitForTimeout(300);
  const transformAfterZoomIn = await page.evaluate(() => currentTransform.k);
  const expectedZoomIn = transformBefore * 1.3;
  log('ZoomIn-Scale', Math.abs(transformAfterZoomIn - expectedZoomIn) < 0.01,
    `${transformBefore.toFixed(3)} → ${transformAfterZoomIn.toFixed(3)} (expected ${expectedZoomIn.toFixed(3)})`);

  // -- Zoom Out Button --
  await page.locator('#zoom-out').click();
  await page.waitForTimeout(300);
  const transformAfterZoomOut = await page.evaluate(() => currentTransform.k);
  log('ZoomOut-Scale', Math.abs(transformAfterZoomOut - transformBefore) < 0.01,
    `back to ${transformAfterZoomOut.toFixed(3)} (expected ~${transformBefore.toFixed(3)})`);

  // -- Zoom Fit Button --
  await page.locator('#expand-all').click();
  await page.waitForTimeout(600);
  await page.locator('#zoom-in').click();
  await page.locator('#zoom-in').click();
  await page.locator('#zoom-in').click();
  await page.waitForTimeout(300);
  const zoomedIn = await page.evaluate(() => currentTransform.k);
  await page.locator('#zoom-fit').click();
  await page.waitForTimeout(300);
  const afterFit = await page.evaluate(() => currentTransform.k);
  log('ZoomFit-Reset', afterFit < zoomedIn, `zoomed ${zoomedIn.toFixed(3)} → fit ${afterFit.toFixed(3)}`);

  await page.screenshot({ path: `${SCRATCHPAD}/icon-04-zoom-fit.png` });

  // -- Toggle Sidebar Button --
  await page.locator('#collapse-all').click();
  await page.waitForTimeout(400);

  await page.locator('#toggle-sidebar').click();
  await page.waitForTimeout(400);

  const sidebarHidden = await page.locator('#sidebar.collapsed').count();
  log('ToggleSidebar-Hide', sidebarHidden > 0, 'sidebar should be collapsed');

  await page.screenshot({ path: `${SCRATCHPAD}/icon-05-sidebar-hidden.png` });

  await page.locator('#toggle-sidebar').click();
  await page.waitForTimeout(400);

  const sidebarShown = await page.locator('#sidebar.collapsed').count();
  log('ToggleSidebar-Show', sidebarShown === 0, 'sidebar should be visible again');

  await page.screenshot({ path: `${SCRATCHPAD}/icon-06-sidebar-shown.png` });

  // ===== SECTION 3: NODE CLICK BEHAVIOR =====
  console.log('\n=== NODE CLICK BEHAVIOR ===');

  // -- Root node click --
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="root"]');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1000);

  const afterRoot = await page.locator('.node-group').count();
  log('RootClick-Expand', afterRoot === 10, `${afterRoot} nodes (expected 10)`);

  const rootBreathingStopped = await page.locator('.node-breathing').count();
  log('RootClick-NoBreathing', rootBreathingStopped === 0);

  // Check spawn animation happened
  const spawningNodes = await page.locator('.node-spawning').count();
  // Spawning animations should have completed by now (0.4s + cascade)
  log('RootClick-SpawnAnimDone', spawningNodes === 0, `${spawningNodes} still spawning (should be 0 after 1s)`);

  await page.screenshot({ path: `${SCRATCHPAD}/icon-07-root-expanded.png` });

  // -- Child node click (Agent Core) --
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="agent-core"]');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1000);

  const afterAgentCore = await page.locator('.node-group').count();
  log('AgentCoreClick-Expand', afterAgentCore === 18, `${afterAgentCore} nodes (expected 18)`);

  // Check selection state
  const selectedNode = await page.evaluate(() => selectedNodeId);
  log('AgentCoreClick-Selected', selectedNode === 'agent-core', `selected: ${selectedNode}`);

  // Check detail panel
  const detailTitle = await page.locator('#detail-content h2').textContent();
  log('AgentCoreClick-DetailPanel', detailTitle === 'Agent Core', `detail: "${detailTitle}"`);

  // Check breadcrumb
  const breadcrumb = await page.locator('#breadcrumb').textContent();
  log('AgentCoreClick-Breadcrumb', breadcrumb.includes('Agent Core'), `breadcrumb: "${breadcrumb}"`);

  await page.screenshot({ path: `${SCRATCHPAD}/icon-08-agent-core-expanded.png` });

  // -- Sibling accordion (click Gateway while Agent Core is expanded) --
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="gateway"]');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1200);

  const afterAccordion = await page.locator('.node-group').count();
  log('Accordion-NodeCount', afterAccordion === 15, `${afterAccordion} nodes (expected 15: agent-core children collapsed, gateway children shown)`);

  // Verify Agent Core's children are gone
  const agentCoreChildren = await page.evaluate(() => {
    const ids = ['tool-engine', 'context-manager', 'model-orchestrator', 'prompt-builder',
                 'sampling-loop', 'memory-system', 'permission-guard', 'diff-engine'];
    return ids.filter(id => document.querySelector(`[data-id="${id}"]`)).length;
  });
  log('Accordion-AgentCoreCollapsed', agentCoreChildren === 0, `${agentCoreChildren} agent-core children still visible`);

  // Verify no collapsing animations lingering
  const collapsingNodes = await page.locator('.node-collapsing').count();
  log('Accordion-NoCollapsingAnim', collapsingNodes === 0, `${collapsingNodes} still collapsing`);

  await page.screenshot({ path: `${SCRATCHPAD}/icon-09-accordion.png` });

  // -- Click already-expanded node to collapse --
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="gateway"]');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(800);

  const afterCollapse = await page.locator('.node-group').count();
  log('CollapseClick-NodeCount', afterCollapse === 10, `${afterCollapse} nodes (expected 10: gateway children hidden)`);

  await page.screenshot({ path: `${SCRATCHPAD}/icon-10-gateway-collapsed.png` });

  // -- Leaf node click --
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="agent-core"]');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(800);

  // Now click a true leaf node under agent-core (session-db has no children)
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="session-db"]');
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(600);

  const leafSelected = await page.evaluate(() => selectedNodeId);
  log('LeafClick-Selected', leafSelected === 'session-db', `selected: ${leafSelected}`);

  const afterLeaf = await page.locator('.node-group').count();
  log('LeafClick-NoExpand', afterLeaf === 18, `${afterLeaf} nodes (should stay 18, leaf has no children)`);

  await page.screenshot({ path: `${SCRATCHPAD}/icon-11-leaf-click.png` });

  // ===== SECTION 4: RAPID CLICK GLITCH TEST =====
  console.log('\n=== RAPID CLICK GLITCH TESTS ===');

  // Reset
  await page.locator('#collapse-all').click();
  await page.waitForTimeout(400);

  // Rapid expand/collapse root
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="root"]');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(100); // Very short wait
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="root"]');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1500); // Wait for all animations

  const afterRapid = await page.locator('.node-group').count();
  log('RapidClick-Stable', afterRapid === 1 || afterRapid === 10,
    `${afterRapid} nodes (should be 1 or 10, not something else)`);

  // Check no orphaned animation classes
  const orphanedSpawning = await page.locator('.node-spawning').count();
  const orphanedCollapsing = await page.locator('.node-collapsing').count();
  log('RapidClick-NoOrphanAnims', orphanedSpawning === 0 && orphanedCollapsing === 0,
    `spawning: ${orphanedSpawning}, collapsing: ${orphanedCollapsing}`);

  await page.screenshot({ path: `${SCRATCHPAD}/icon-12-rapid-click.png` });

  // Rapid sibling switching
  await page.locator('#collapse-all').click();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelector('[data-id="root"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1000); // Wait for root expansion to fully complete

  // Verify children are available before rapid clicking
  const childrenReady = await page.locator('[data-id="agent-core"]').count();
  log('RapidSibling-ChildrenReady', childrenReady > 0, `agent-core found: ${childrenReady}`);

  // Rapidly click different siblings (cli-system is the actual ID, not cli)
  await page.evaluate(() => {
    document.querySelector('[data-id="agent-core"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    document.querySelector('[data-id="gateway"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    document.querySelector('[data-id="cli-system"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  const afterRapidSibling = await page.locator('.node-group').count();
  // Only cli-system children + root level should be visible
  const cliChildCount = await page.evaluate(() => {
    const cliNode = nodeMap['cli-system'];
    return cliNode && cliNode.children ? cliNode.children.length : 0;
  });
  const expectedAfterCli = 1 + 9 + cliChildCount; // root + 9 first-level + cli-system children
  log('RapidSibling-Stable', afterRapidSibling === expectedAfterCli,
    `${afterRapidSibling} nodes (expected ${expectedAfterCli})`);

  const orphanedAfterSibling = await page.locator('.node-collapsing').count();
  log('RapidSibling-NoCollapsingAnims', orphanedAfterSibling === 0,
    `orphaned collapsing: ${orphanedAfterSibling}`);

  await page.screenshot({ path: `${SCRATCHPAD}/icon-13-rapid-sibling.png` });

  // ===== SECTION 5: EXPAND ALL → COLLAPSE ALL RAPID =====
  console.log('\n=== EXPAND/COLLAPSE ALL RAPID ===');

  await page.locator('#expand-all').click();
  await page.waitForTimeout(200); // Very short
  await page.locator('#collapse-all').click();
  await page.waitForTimeout(1000);

  const afterRapidToggle = await page.locator('.node-group').count();
  log('RapidExpandCollapse-Stable', afterRapidToggle === 1, `${afterRapidToggle} nodes (expected 1)`);

  await page.screenshot({ path: `${SCRATCHPAD}/icon-14-rapid-expand-collapse.png` });

  // ===== SECTION 6: NAVIGATION AND BREADCRUMB =====
  console.log('\n=== NAVIGATION & BREADCRUMB ===');

  await page.locator('#collapse-all').click();
  await page.waitForTimeout(400);

  // Use navigateToNode to jump deep (aiagent-class is under agent-core)
  await page.evaluate(() => navigateToNode('aiagent-class'));
  await page.waitForTimeout(1000);

  const navNodes = await page.locator('.node-group').count();
  log('NavigateToNode-Expanded', navNodes > 1, `${navNodes} nodes visible after navigating to aiagent-class`);

  const navBreadcrumb = await page.locator('#breadcrumb').textContent();
  log('NavigateToNode-Breadcrumb', navBreadcrumb.includes('AIAgent Class'),
    `breadcrumb: "${navBreadcrumb}"`);

  // Check highlight class applied and then removed
  const highlighted = await page.locator('.highlight').count();
  log('NavigateToNode-HighlightCleared', highlighted === 0,
    `${highlighted} highlighted nodes (should be 0 after 1s, animation is 0.6s)`);

  await page.screenshot({ path: `${SCRATCHPAD}/icon-15-navigate-to-node.png` });

  // ===== SECTION 7: SIDEBAR TOGGLE DURING INTERACTIONS =====
  console.log('\n=== SIDEBAR DURING INTERACTIONS ===');

  // Toggle sidebar while nodes are expanded
  await page.locator('#toggle-sidebar').click();
  await page.waitForTimeout(400);

  // Click a node while sidebar is collapsing
  await page.evaluate(() => {
    const el = document.querySelector('[data-id="agent-core"]');
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(800);

  const sidebarState = await page.locator('#sidebar.collapsed').count();
  log('SidebarInteraction-Collapsed', sidebarState > 0, 'sidebar stays collapsed during node click');

  await page.screenshot({ path: `${SCRATCHPAD}/icon-16-sidebar-interaction.png` });

  // Toggle sidebar back
  await page.locator('#toggle-sidebar').click();
  await page.waitForTimeout(400);

  // ===== SECTION 8: CROSS-CONNECTION RENDERING =====
  console.log('\n=== CROSS-CONNECTION RENDERING ===');

  await page.locator('#expand-all').click();
  await page.waitForTimeout(800);

  const crossPaths = await page.evaluate(() => {
    const crossGroup = document.getElementById('cross-group');
    return crossGroup ? crossGroup.querySelectorAll('path').length : 0;
  });
  log('CrossConn-Rendered', crossPaths > 0, `${crossPaths} cross-connection paths rendered`);

  // Check if cross-connections reference visible nodes
  const phantomConns = await page.evaluate(() => {
    const crossGroup = document.getElementById('cross-group');
    if (!crossGroup) return 0;
    const paths = crossGroup.querySelectorAll('path');
    let phantom = 0;
    paths.forEach(p => {
      const d = p.getAttribute('d');
      if (d && (d.includes('NaN') || d.includes('undefined'))) phantom++;
    });
    return phantom;
  });
  log('CrossConn-NoPhantom', phantomConns === 0, `${phantomConns} phantom connections with NaN/undefined coords`);

  await page.screenshot({ path: `${SCRATCHPAD}/icon-17-cross-connections.png` });

  // ===== SECTION 9: CONSOLE ERRORS CHECK =====
  console.log('\n=== CONSOLE ERRORS ===');
  log('NoConsoleErrors', consoleErrors.length === 0,
    consoleErrors.length > 0 ? `Errors: ${consoleErrors.join('; ')}` : 'clean');

  // ===== SUMMARY =====
  console.log('\n========================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  console.log('========================================');

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})().catch(err => {
  console.error('Test error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
