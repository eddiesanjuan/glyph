// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Glyph',
			description: 'AI-powered PDF customization. 2 lines of code. Unlimited possibilities.',
			logo: {
				light: './src/assets/glyph-logo-light.svg',
				dark: './src/assets/glyph-logo-dark.svg',
				replacesTitle: true,
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/glyph-so/glyph' },
				{ icon: 'x.com', label: 'X', href: 'https://x.com/glyph_so' },
			],
			customCss: [
				'./src/styles/custom.css',
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Quick Start', slug: 'getting-started/quickstart' },
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Basic Usage', slug: 'getting-started/basic-usage' },
					],
				},
				{
					label: 'API Reference',
					items: [
						{ label: 'Overview', slug: 'api/overview' },
						{ label: 'POST /v1/preview', slug: 'api/preview' },
						{ label: 'POST /v1/modify', slug: 'api/modify' },
						{ label: 'POST /v1/generate', slug: 'api/generate' },
						{ label: 'Authentication', slug: 'api/authentication' },
						{ label: 'Rate Limits', slug: 'api/rate-limits' },
						{ label: 'Error Codes', slug: 'api/error-codes' },
					],
				},
				{
					label: 'SDK Reference',
					items: [
						{ label: 'Overview', slug: 'sdk/overview' },
						{ label: '<glyph-editor>', slug: 'sdk/glyph-editor' },
						{ label: 'Events', slug: 'sdk/events' },
						{ label: 'Methods', slug: 'sdk/methods' },
						{ label: 'Theming', slug: 'sdk/theming' },
					],
				},
				{
					label: 'Templates',
					items: [
						{ label: 'Overview', slug: 'templates/overview' },
						{ label: 'quote-modern', slug: 'templates/quote-modern' },
						{ label: 'quote-professional', slug: 'templates/quote-professional' },
						{ label: 'quote-bold', slug: 'templates/quote-bold' },
						{ label: 'Custom Templates', slug: 'templates/custom' },
					],
				},
				{
					label: 'Examples',
					items: [
						{ label: 'Quoted Integration', slug: 'examples/quoted' },
						{ label: 'React', slug: 'examples/react' },
						{ label: 'Vue', slug: 'examples/vue' },
						{ label: 'Vanilla JS', slug: 'examples/vanilla' },
					],
				},
			],
			head: [
				{
					tag: 'meta',
					attrs: {
						property: 'og:image',
						content: 'https://docs.glyph.you/og-image.png',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'icon',
						href: '/favicon.svg',
						type: 'image/svg+xml',
					},
				},
			],
			editLink: {
				baseUrl: 'https://github.com/glyph-so/glyph/edit/main/docs/',
			},
		}),
	],
});
