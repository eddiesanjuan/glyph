// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
	site: 'https://docs.glyph.you',
	trailingSlash: 'never',
	integrations: [
		starlight({
			title: 'Glyph',
			description: 'AI-powered PDF customization. 2 lines of code. Unlimited possibilities.',
			logo: {
				light: './src/assets/glyph-logo-light.svg',
				dark: './src/assets/glyph-logo-dark.svg',
				replacesTitle: true,
			},
			components: {
				// Override SiteTitle to link to docs homepage instead of main landing page
				SiteTitle: './src/components/SiteTitle.astro',
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
					label: 'Integrations',
					items: [
						{ label: 'Webhooks & Automation', slug: 'integrations/webhooks' },
						{ label: 'Airtable', slug: 'integrations/airtable' },
						{ label: 'MCP Server', slug: 'integrations/mcp-server' },
						{ label: 'Agent Frameworks', slug: 'integrations/agent-frameworks' },
					],
				},
				{
					label: 'API Reference',
					items: [
						{ label: 'Overview', slug: 'api/overview' },
						{ label: 'Data-First API (Recommended)', slug: 'api/create' },
						{ label: 'POST /v1/preview', slug: 'api/preview' },
						{ label: 'POST /v1/modify', slug: 'api/modify' },
						{ label: 'Streaming Modifications', slug: 'api/streaming' },
						{ label: 'POST /v1/generate', slug: 'api/generate' },
						{ label: 'GET /v1/documents', slug: 'api/documents' },
						{ label: 'POST /v1/batch/generate', slug: 'api/batch' },
						{ label: 'Custom Templates API', slug: 'api/templates-saved' },
						{ label: 'Authentication', slug: 'api/authentication' },
						{ label: 'Rate Limits', slug: 'api/rate-limits' },
						{ label: 'Limits & Quotas', slug: 'api/limits-quotas' },
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
						{ label: 'invoice-clean', slug: 'templates/invoice-clean' },
						{ label: 'receipt-minimal', slug: 'templates/receipt-minimal' },
						{ label: 'report-cover', slug: 'templates/report-cover' },
						{ label: 'contract-simple', slug: 'templates/contract-simple' },
						{ label: 'certificate-modern', slug: 'templates/certificate-modern' },
						{ label: 'letter-business', slug: 'templates/letter-business' },
						{ label: 'Custom Templates', slug: 'templates/custom' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Custom Templates', slug: 'guides/custom-templates' },
						{ label: 'Batch PDF Generation', slug: 'guides/batch-generation' },
						{ label: 'Troubleshooting', slug: 'guides/troubleshooting' },
					],
				},
				{
					label: 'Examples',
					items: [
						{ label: 'Quoted Integration', slug: 'examples/quoted' },
						{ label: 'React', slug: 'examples/react' },
						{ label: 'React (Full Guide)', slug: 'examples/react-integration' },
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
				{
					tag: 'script',
					attrs: {
						type: 'application/ld+json',
					},
					content: JSON.stringify({
						"@context": "https://schema.org",
						"@type": "SoftwareApplication",
						"name": "Glyph",
						"description": "AI-powered PDF generation API. Generate PDFs with natural language.",
						"applicationCategory": "DeveloperApplication",
						"operatingSystem": "Any",
						"offers": {
							"@type": "Offer",
							"price": "0",
							"priceCurrency": "USD"
						},
						"url": "https://glyph.you",
						"author": {
							"@type": "Organization",
							"name": "Glyph",
							"url": "https://glyph.you"
						}
					}),
				},
				{
					tag: 'script',
					attrs: {
						type: 'application/ld+json',
					},
					content: JSON.stringify({
						"@context": "https://schema.org",
						"@type": "Organization",
						"name": "Glyph",
						"url": "https://glyph.you",
						"logo": "https://glyph.you/logo.svg",
						"description": "AI-powered PDF generation for developers",
						"sameAs": [
							"https://github.com/glyph-so/glyph",
							"https://x.com/glyph_so"
						]
					}),
				},
			],
			editLink: {
				baseUrl: 'https://github.com/glyph-so/glyph/edit/main/docs/',
			},
		}),
		sitemap(),
	],
});
