# 筑检 AI 巡检台

静态网页：现场照片、人工问题记录、确认与文书草稿导出。手机与桌面均可使用。

## 当前状态
- 不包含示例照片或示例识别结果，首次进入为空白检查。
- 上传的照片与记录只保存在当前浏览器，不会提交到 GitHub。
- 已准备豆包 Responses API 后台代码；部署并填写云端密钥后可识别。
- 规范依据由检查人员填写和核对，导出文件为草稿。

## GitHub Pages
在仓库 Settings → Pages 中选择 Deploy from a branch，选择 main 分支与根目录。

## Vercel 部署后台

1. 使用 GitHub 登录 Vercel，Add New → Project → 导入 OrangQ7/zhujian-ai。
2. Framework Preset 选择 Other，保留仓库根目录，Build Command 留空，不设置输出子目录。
3. 在 Environment Variables 填写：

| 名称 | 值 |
| --- | --- |
| ARK_API_KEY | 新创建的火山方舟密钥 |
| ARK_MODEL | doubao-seed-2-1-pro-260915 |
| ARK_MODEL_FAST | 可选：「快速识别」用的轻量视觉模型 Model ID；不填则快速识别也用 ARK_MODEL |
| ARK_API_KEY_FAST | 可选：轻量模型所在账号的密钥；不填则用 ARK_API_KEY |

「深度思考」始终使用 ARK_MODEL 和 ARK_API_KEY。


4. Deploy。之后修改环境变量须重新部署。
5. 打开网站，上传照片，点击“开始识别”，无需输入网址或口令。
6. 所有返回问题默认待确认，规范依据默认未核验。

API Key 永远只填写在 Vercel 后台。旧的 APP_ACCESS_CODE 环境变量不再使用。
识别接口对外开放并消耗项目方模型额度；正式运营时可增加无感额度控制。

未调用真实付费 API；自动测试使用模拟响应，不验证具体模型开通状态及生产网络。

## 接入结构
浏览器 → 自有后端 / 云函数 → 火山方舟视觉模型。
API Key 只能存放于云端环境变量，不能写入 index.html 或 GitHub 仓库。
GitHub Pages 只托管静态前端，不能执行保管密钥与调用模型的后端代码。

## 本地运行
使用任意静态 HTTP 服务打开 index.html，或直接在浏览器打开该文件。
