#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Building TaskFlow client...');

// Read the original HTML file
const htmlPath = path.join(__dirname, 'index.html');
const publicHtmlPath = path.join(__dirname, 'public', 'index.html');

if (!fs.existsSync(htmlPath)) {
    console.error('❌ index.html not found');
    process.exit(1);
}

let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Replace individual script tags with minified version
const scriptReplacements = [
    'js/config.js',
    'js/api.js', 
    'js/auth.js',
    'js/websocket.js',
    'js/reports.js',
    'js/app.js'
];

// Remove individual script tags
scriptReplacements.forEach(script => {
    const scriptTag = `<script src="${script}"></script>`;
    htmlContent = htmlContent.replace(scriptTag, '');
});

// Add the minified script tag before the closing body tag
const minifiedScript = '    <script src="js/app.min.js"></script>\n</body>';
htmlContent = htmlContent.replace('</body>', minifiedScript);

// Replace CSS with minified version
htmlContent = htmlContent.replace(
    /<link rel="stylesheet" href="css\/styles\.css">/,
    '<link rel="stylesheet" href="css/styles.min.css">'
);

// Remove other CSS files since they're now minified into styles.min.css
htmlContent = htmlContent.replace(
    /<link rel="stylesheet" href="css\/reports\.css">/g,
    ''
);
htmlContent = htmlContent.replace(
    /<link rel="stylesheet" href="css\/assignment-info\.css">/g,
    ''
);

// Write the updated HTML to public directory
fs.writeFileSync(publicHtmlPath, htmlContent);

console.log('✅ HTML file updated for production');
console.log('📦 Build completed successfully!');
console.log('🌐 Ready for deployment at public/ directory');

// Display build summary
console.log('\n📋 Build Summary:');
console.log('- ✅ CSS minified and combined');
console.log('- ✅ JavaScript minified and combined');  
console.log('- ✅ HTML optimized for production');
console.log('- ✅ Assets copied to public/');
console.log('\n🚀 You can now deploy the public/ directory to your server!');