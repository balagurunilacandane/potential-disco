// Packs the demo build (dist-demo/) into one self-contained HTML page: agent-world.html.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '../dist-demo');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const read = (href) => fs.readFileSync(path.join(dir, href.replace(/^\.?\//, '')), 'utf8');

const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => read(m[1])).join('\n');
const js = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => read(m[1])).join('\n');
const title = html.match(/<title>.*?<\/title>/)?.[0] ?? '<title>Agent World</title>';

// A literal "</script" inside the bundle would end the inline tag early.
const safeJs = js.replace(/<\/script/gi, '<\\/script');

const page = `${title}
<meta name="description" content="Isometric voxel office where AI agent teams work and report to a central brain." />
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;
const out = path.join(dir, 'agent-world.html');
fs.writeFileSync(out, page);
console.log(`wrote ${out} (${(page.length / 1024).toFixed(0)} KB)`);
