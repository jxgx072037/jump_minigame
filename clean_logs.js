const fs = require("fs"); const filePath = "src/game/engine.ts"; fs.copyFileSync(filePath, filePath + ".bak"); const data = fs.readFileSync(filePath, "utf8"); const cleaned = data.split("
").filter(line => !line.trim().startsWith("console.log(") || line.includes("失败") || line.includes("Error") || line.includes("成功") || line.includes("完成")).join("
"); fs.writeFileSync(filePath, cleaned);
