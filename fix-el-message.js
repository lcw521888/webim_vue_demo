const fs = require('fs');
const path = require('path');

// 读取文件内容
const filePath = path.join(__dirname, 'src/views/Chat/components/Chatroom/index.vue');
let content = fs.readFileSync(filePath, 'utf8');

// 修复模式1: 三个参数的情况 - 例如: ElMessage.info('xxx:', var1, 'yyy:', var2)
content = content.replace(/ElMessage\.(info|success|warning|error)\('([^']*)':,\s*([^,]*)\s*,\s*'([^']*)':,\s*([^)]*)\)/g,
  (match, method, part1, var1, part2, var2) => {
    return `ElMessage.${method}(${part1}: {${var1.trim()}} ${part2}: {JSON.stringify(${var2.trim()})})`;
  }
);

// 修复模式2: 两个参数的情况 - 例如: ElMessage.info('xxx:', var1)
content = content.replace(/ElMessage\.(info|success|warning|error)\('([^']*)':,\s*([^)]*)\)/g,
  (match, method, part1, var1) => {
    return `ElMessage.${method}(${part1}: {${var1.trim()}})`;
  }
);

// 修复模式3: 四个参数的情况 - 例如: ElMessage.info('xxx:', var1, 'yyy:', var2, 'zzz:', var3)
content = content.replace(/ElMessage\.(info|success|warning|error)\('([^']*)':,\s*([^,]*)\s*,\s*'([^']*)':,\s*([^,]*)\s*,\s*'([^']*)':,\s*([^)]*)\)/g,
  (match, method, part1, var1, part2, var2, part3, var3) => {
    return `ElMessage.${method}(${part1}: {${var1.trim()}} ${part2}: {${var2.trim()}} ${part3}: {JSON.stringify(${var3.trim()})})`;
  }
);

// 保存修复后的内容
fs.writeFileSync(filePath, content, 'utf8');
console.log('修复完成！');
