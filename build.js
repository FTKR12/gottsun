// concatenates src/* into one self-contained index.html
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const r = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const js = ['data.js', 'engine.js', 'ai.js', 'art.js', 'audio.js', 'input.js', 'net.js', 'ui.js'].map(r).join('\n');
let html = r('head.html') + r('style.css') + '</style>\n</head>\n<body>\n' + r('body.html') + '<script>\n' + js + '\n</script>\n</body>\n</html>\n';
// a build id from the contents, so an open page can tell that the site has a newer one
const id = crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
html = html.split('__BUILD__').join(id);
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html', html.length, 'chars, build', id);
