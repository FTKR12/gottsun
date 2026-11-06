// concatenates src/* into one self-contained index.html
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const js = ['data.js', 'engine.js', 'ai.js', 'art.js', 'audio.js', 'input.js', 'net.js', 'ui.js'].map(r).join('\n');
const html = r('head.html') + r('style.css') + '</style>\n</head>\n<body>\n' + r('body.html') + '<script>\n' + js + '\n</script>\n</body>\n</html>\n';
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html', html.length, 'chars');
