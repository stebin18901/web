// generate-sitemap.js
const { SitemapStream, streamToPromise } = require('sitemap');
const { createWriteStream } = require('fs');
const path = require('path');

// Your website's domain
const baseUrl = 'https://hepsy.in';

const links = [
  { url: '/', changefreq: 'weekly', priority: 1.0 },
  { url: '/about', changefreq: 'monthly', priority: 0.8 },
  { url: '/contact', changefreq: 'monthly', priority: 0.8 },
  { url: '/quiz', changefreq: 'weekly', priority: 0.9 },
  // Add more URLs as needed
];

(async () => {
  const sitemap = new SitemapStream({ hostname: baseUrl });
  const writeStream = createWriteStream(path.resolve(__dirname, './public/sitemap.xml'));

  sitemap.pipe(writeStream);

  links.forEach(link => sitemap.write(link));
  sitemap.end();

  await streamToPromise(sitemap);
  console.log('✅ Sitemap generated at /public/sitemap.xml');
})();
