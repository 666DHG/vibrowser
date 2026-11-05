# Windows PowerShell 冷启动修复（2026-11-05）

## 原因与修复

在 PostgreSQL 55432 未运行时，`database.ps1` 先执行 `psql SHOW data_directory`，确认是否存在另一实例。Windows PowerShell 5.1 在 `$ErrorActionPreference = 'Stop'` 下将重定向的原生命令 stderr 转成终止错误，脚本来不及检查退出码，也不会执行 `pg_ctl start`。PowerShell 7 下未复现，因此仅在 PowerShell 7 验证启动不足以发现此问题。

仅在这次允许失败的探测期间使用 `Continue`，保存退出码，并在 `finally` 恢复错误策略。后续启动、建库错误仍按原规则失败；原有数据目录检查仍保留。未修改数据库数据、凭据或应用代码。

## 验证

- 修复前以 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 -SkipBuild -Wait` 复现与用户完全相同的 `NativeCommandError`。
- 修复后同一 Windows PowerShell 冷启动成功，后端 `/health` 返回 `status=ok, mock=false`，前端返回 HTTP 200。
- 已运行时再次执行 `database.ps1 start` 成功，无重复初始化。
- Windows PowerShell 完整编译启动另行验证；编译成功。PowerShell 7 完整启动在本轮修复前也通过。
- 开发工具跨执行会话的 `stop.ps1` 未能访问记录的进程，按设计拒绝停止；通过原启动会话结束进程后重新启动。此项不计作跨会话停止通过。

## 使用

在项目目录执行 ` .\scripts\start.ps1 -Wait`；代码未改动可加 `-SkipBuild`。保持启动终端开启。原生用户终端中可执行 ` .\scripts\stop.ps1` 停止；开发工具隔离会话需在原启动会话结束。应用地址为 http://127.0.0.1:5173/ 。
