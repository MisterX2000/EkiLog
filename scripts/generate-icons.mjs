import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const svgPath = path.join(rootDir, 'static', 'favicon.svg');
const outDir = path.join(rootDir, 'static');

async function generateIcons() {
	let sharp;
	try {
		const sharpModule = await import('sharp');
		sharp = sharpModule.default || sharpModule;
	} catch (e) {
		console.error('❌ Error: sharp library is required to generate icons.');
		console.error('Please install it by running: npm install -D sharp');
		console.error(
			'Or run this script via npx: npx -y --package=sharp node scripts/generate-icons.mjs'
		);
		process.exit(1);
	}

	if (!fs.existsSync(svgPath)) {
		console.error(`❌ Error: Source SVG not found at ${svgPath}`);
		process.exit(1);
	}

	console.log(`🎨 Reading source vector icon: static/favicon.svg`);
	const svgBuffer = fs.readFileSync(svgPath);

	const targets = [
		{ name: 'icon-192.png', size: 192, format: 'png' },
		{ name: 'icon-512.png', size: 512, format: 'png' },
		{ name: 'icon-maskable-512.png', size: 512, format: 'png' }
	];

	console.log('⚡ Generating PWA raster icons...\n');

	for (const target of targets) {
		const outPath = path.join(outDir, target.name);
		const pipeline = sharp(svgBuffer)
			.resize(target.size, target.size)
			.png({ compressionLevel: 9, quality: 90 });

		await pipeline.toFile(outPath);
		console.log(
			`  ✅ Generated: static/${target.name.padEnd(21)} (${target.size}x${target.size} ${target.format.toUpperCase()})`
		);
	}

	console.log('\n🚀 All PWA icons generated successfully!');
}

generateIcons().catch((err) => {
	console.error('❌ Unexpected error during icon generation:', err);
	process.exit(1);
});
