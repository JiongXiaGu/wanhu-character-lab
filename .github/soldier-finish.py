from pathlib import Path
import json

def patch(path,old,new):
    p=Path(path);s=p.read_text();assert old in s,(path,old);p.write_text(s.replace(old,new))
def section(path,title,body):
    p=Path(path);s=p.read_text();a=s.index(title);b=s.find('\n## ',a+len(title));b=len(s) if b<0 else b;p.write_text(s[:a]+body.rstrip()+'\n'+s[b:])

p='src/character/wardrobe/assets/military/palace-top.ts'
patch(p,'  const rows:TorsoRow[]=[',"  const tone=(hex:string,k:number)=>'#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(hex.slice(i,i+2),16)*k)).toString(16).padStart(2,'0')).join('');\n  const seam=tone(iron,.70),plate=tone(iron,1.22),dark=tone(iron,.90);\n  const band=(color:string)=>[color,color,seam,color,color,color];\n  const rows:TorsoRow[]=[")
patch(p,"['Belt',1.080,.171,.112,cuts,torsoWaist]","['Belt',1.080,.171,.112,[-.065,-.039,.039,.065],torsoWaist]")
patch(p,"['BeltTop',1.107,.177,.117,cuts,torsoWaist]","['BeltTop',1.107,.177,.117,[-.065,-.039,.039,.065],torsoWaist]")
patch(p,'    solidBand(iron),[iron,iron,bronze,iron,iron,iron],\n    solidBand(iron),[iron,iron,bronze,iron,iron,iron],\n    solidBand(iron),solidBand(iron),[iron,cloth,cloth,cloth,iron,iron],solidBand(cloth),','    band(dark),[cloth,cloth,bronze,cloth,cloth,cloth],\n    band(plate),band(dark),band(plate),band(iron),[iron,cloth,cloth,cloth,iron,iron],solidBand(cloth),')
p='src/character/wardrobe/assets/military/palace-skirt.ts'
patch(p,"f.region==='pelvis'?recipe.dyes.secondary:recipe.dyes.primary","f.region==='pelvis'||f.v.every(i=>/\\.(Root|Thigh)\\./.test(c.vertices[i].id))?recipe.dyes.secondary:recipe.dyes.primary")
patch(p,'radii=rear?[.119,.118,.116]:[.119,.113,.092]','radii=rear?[.116,.113,.110]:panel===\'Outer\'?[.101,.100,.085]:[.103,.099,.083]')
patch('src/character/wardrobe/assets/military/boots.ts','LEG','OCT')
p='scripts/check-soldier-browser.mjs'
patch(p,"buffer:bytes});assert.deepEqual(await recipe(),saved);","buffer:bytes});await page.waitForFunction(()=>window.__WANHU_RECIPE__().slots.top==='palace_guard_armor');assert.deepEqual(await recipe(),saved);")
patch(p,"profession:'soldier'}))});assert.deepEqual(await recipe(),saved);","profession:'soldier'}))});await page.locator('.notice-error').waitFor({state:'visible'});assert.deepEqual(await recipe(),saved);")

p=Path('package.json');v=json.loads(p.read_text());v['scripts']['check:soldier']='tsx scripts/check-soldier.ts && tsx scripts/check-soldier-assets.ts';v['scripts']['check:soldier-browser']='node scripts/check-soldier-browser.mjs';v['scripts']['review:soldier']='node scripts/check-soldier-browser.mjs --screenshots';p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
p=Path('.github/workflows/targeted-checks.yml')
s=p.read_text();assert '\n  soldier:' not in s
s+='''
  soldier:
    name: Soldier assets, source-key motion and desktop checks
    runs-on: ubuntu-latest
    timeout-minutes: 25
    env:
      REVIEW_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}
      SOLDIER_CHECK_DIR: /tmp/wanhu-soldier-checks/numeric
      SOLDIER_BROWSER_DIR: /tmp/wanhu-soldier-checks/browser
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ env.REVIEW_HEAD_SHA }}
          fetch-depth: 0
          persist-credentials: false
      - id: scope
        name: Resolve soldier scope
        env:
          EVENT_NAME: ${{ github.event_name }}
          PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}
          PUSH_BEFORE_SHA: ${{ github.event.before }}
        run: |
          set -euo pipefail
          test "$(git rev-parse HEAD)" = "$REVIEW_HEAD_SHA"
          required=false
          if [[ "$EVENT_NAME" == workflow_dispatch ]]; then required=true
          else
            if [[ "$EVENT_NAME" == pull_request ]]; then BASE="$PR_BASE_SHA"; else BASE="$PUSH_BEFORE_SHA"; fi
            if [[ -z "$BASE" || "$BASE" =~ ^0+$ ]]; then BASE="$(git rev-parse HEAD^)"; fi
            while IFS= read -r path; do
              case "$path" in src/soldier/*|src/character/*|src/scene/CharacterViewport.tsx|src/App.tsx|src/animation/*|scripts/check-soldier*|scripts/check-garment*|scripts/check-components*|scripts/prepare-*|scripts/lib/*|public/mixamo/*|public/system-animator/*|public/mediapipe/*|动画参考/*|动画参考_glb/*|Documentation/皇宫禁卫与长枪.md|Documentation/军人与甲胄工作流.md|package.json|package-lock.json|.github/workflows/*) required=true ;; esac
            done < <(git -c core.quotepath=false diff --name-only "$BASE" HEAD)
          fi
          echo "required=$required" >> "$GITHUB_OUTPUT"
      - uses: actions/setup-node@v4
        if: steps.scope.outputs.required == 'true'
        with:
          node-version: 22
          cache: npm
      - run: npm ci
        if: steps.scope.outputs.required == 'true'
      - name: Prepare actual motion inventory
        if: steps.scope.outputs.required == 'true'
        run: npm run prepare:motion
      - name: Closed soldier assets, identity and fault injection
        if: steps.scope.outputs.required == 'true'
        run: npm run check:soldier
      - name: Actual skinned source keys and midpoints
        if: steps.scope.outputs.required == 'true'
        run: npx tsx scripts/check-soldier-assets.ts --motion
      - name: Install desktop browser
        if: steps.scope.outputs.required == 'true'
        run: npx playwright install --with-deps chromium
      - name: Soldier desktop interactions without screenshots
        if: steps.scope.outputs.required == 'true'
        run: npm run check:soldier-browser
      - uses: actions/upload-artifact@v4
        if: always() && steps.scope.outputs.required == 'true'
        with:
          name: soldier-s1-checks-${{ env.REVIEW_HEAD_SHA }}
          path: /tmp/wanhu-soldier-checks/
          if-no-files-found: warn
          retention-days: 14
'''
p.write_text(s)
p='.github/workflows/manual-visual-review.yml'
patch(p,'          - back-equipment\n','          - back-equipment\n          - soldier\n')
patch(p,"if: github.event_name == 'workflow_dispatch' || contains(github.event.pull_request.title, '[back-visual]')","if: github.event_name == 'workflow_dispatch' || contains(github.event.pull_request.title, '[back-visual]') || contains(github.event.pull_request.title, '[soldier-visual]')")
patch(p,"inputs.scope || 'back-equipment'","inputs.scope || (contains(github.event.pull_request.title, '[soldier-visual]') && 'soldier' || 'back-equipment')")
patch(p,'            elif [[ "$scope" == livestock ]]; then','            elif [[ "$scope" == soldier ]]; then\n              npm run review:soldier 2>&1 | tee -a manual-visual-review.log\n            elif [[ "$scope" == livestock ]]; then')
patch(p,'character|back-equipment|wardrobe|lightwear|skirts|motion|system-animator|horse|livestock)','character|back-equipment|soldier|wardrobe|lightwear|skirts|motion|system-animator|horse|livestock)')
patch(p,'for scope in character back-equipment wardrobe lightwear skirts motion horse livestock; do','for scope in character back-equipment soldier wardrobe lightwear skirts motion horse livestock; do')

section('AGENTS.md','## S0 军人与甲胄工作流','''## S1 皇宫禁卫与长枪

用户已授权制作第一套真实宫卫。先读 `Documentation/皇宫禁卫与长枪.md` 和《军人与甲胄工作流》。五件新资产已走原七槽位、固定成年男女、20骨与最多双权重；`src/soldier/looks.ts`只应用外观，不另建Renderer、动画播放器、兵种或军阶协议。旧军服与boots仍退役，边疆城市仅为规划，不开放空选项。

上甲与护肩为连续闭合衣壳；六片甲裙各自闭合、随对应Thigh，裤装内衬保留髋膝遮挡；军靴只覆盖foot。原下身源键/中点检测、Snatch压力片段、固定身体与inverse bind不变，不加军装豁免。长枪只随RightHand，不宣称专用站岗、刺击、双手握枪或战斗已实现。

`check:soldier`检查真实资产，Targeted追加源键蒙皮和普通桌面交互；`review:soldier`与Manual soldier scope/[soldier-visual]显式产图。必须实际打开关键图并直接展示，区分自动通过、生成、AI看图与用户美术认可。保留猫和其它并行修改，合并前重读main，不强推，不留下临时作者工作流。
''')
patch('AGENTS.md','正式衣柜7上衣／5下装／1鞋','正式衣柜8上衣／6下装／2鞋')
patch('AGENTS.md','鞋cloth_shoes。guard_light_armor','鞋cloth_shoes与military_boots；新增宫卫上甲与甲裙见专篇。guard_light_armor')
section('README.md','## S0：军人与甲胄工作流','''## S1：皇宫禁卫 · 长枪

人物工坊右侧「军人试衣」可应用宫卫红缨盔、札甲、分片甲裙与裤装、短筒军靴和长枪，五件也能在原槽位独立混搭。整套应用保留当前男女、发式和发色，仍为Recipe V5、七槽位、20骨；不会把士兵加入默认平民随机池。

入口 `?soldier=palace&pose=bind&paused=1`；加 `&view=overview` 为经营俯视。五件新增几何共1050三角形，整套男女分别1243/1245三角形。长枪随右手变换，尚无专用持枪战斗动作；边疆与城市没有空模型占位。详见[皇宫禁卫与长枪](Documentation/皇宫禁卫与长枪.md)及[长期工作流](Documentation/军人与甲胄工作流.md)。

`check:soldier`与普通桌面交互已纳入Targeted，`review:soldier`或Manual soldier scope显式生成真实WebGL关键图。各项结果与精确受测SHA以对应PR为准，自动通过不代表用户已认可美术。
''')
patch('README.md','正式人物衣柜仍7上衣、5下装、1布鞋','正式人物衣柜为8上衣、6下装、2鞋，新增宫卫札甲、甲裙与军靴')
p=Path('Documentation/工作交接.md');s=p.read_text();a=s.index('## S0：军人与甲胄工作流');s=s[:a]+s[a:].replace('## S0：军人与甲胄工作流','## S0：军人与甲胄工作流（历史建项）',1).replace('下一阶段为 S1','该阶段安排的下一步为 S1',1)
intro='''## S1：皇宫禁卫与长枪

在main `95f231f7eb0ec3cd45f4583b3a86f3a889203d55`上接入五件真实宫卫资产，保留田园猫及原人物、动作、背具和六种坐骑。实现、所有权、预算和边界集中于《皇宫禁卫与长枪.md》；本段基线不是之后接手时的最新HEAD。

新增原人物工坊的显式整套试衣与经营俯视，原十张平民搭配、随机池和存档协议不变。首次截图用于增加胸甲分层、收紧甲裙、修正靴筒截面。原五片段下身源键/中点检查无新增豁免；新专项检查实际绑定、刚性装备、真实源键蒙皮和12种故障反例。普通浏览器检查与截图入口分别运行，文件导入须等待读取完成后断言。

本地数值与runner浏览器证据必须分开；本地缺原始FBX库存，不把本地有限检查冒充完整源文件回归。精确受测SHA、正式Actions结果、实际看图与合并记录以对应PR为准。第一套造型仍需用户验收；不以通用动画试衣宣称专用长枪站岗或战斗已实现，不自行进入边疆、城市或战斗系统。

'''
p.write_text(s.replace('# 工作交接\n','# 工作交接\n\n'+intro,1))
p='Documentation/固定基模与换装V5.md'
patch(p,'patterns当前管理7上衣／5下装；鞋只保留cloth_shoes。','patterns当前管理8上衣／6下装；鞋为cloth_shoes与military_boots。宫卫独立资产见《皇宫禁卫与长枪》，不升级Recipe。')
patch(p,'wanhu-modular-garments-v7','wanhu-modular-garments-v9')
patch(p,'资源v7不是Recipe升级','资源版本不是Recipe升级')
patch(p,'当前5款正式下装加body','当前6款正式下装加body')
p='Documentation/服装生成架构.md'
patch(p,'注册7上衣与5下装','注册8上衣与6下装')
patch(p,'trousers.ts负责两种实用长裤及下装分派；','trousers.ts负责下装分派；两种实用长裤的原闭裆操作提取到trouser-shell，数值和权重不变，宫卫只复用裤装内衬。')
patch(p,'footwear当前只负责cloth_shoes；','footwear负责cloth_shoes并分派military/boots的独立军靴；')
patch(p,'当前上衣work_vest128','当前宫卫上甲386、甲裙与裤装360、军靴120，作者规则见《皇宫禁卫与长枪》。原上衣work_vest128')
p='Documentation/军人与甲胄工作流.md'
patch(p,'## 目标与边界','当前已进入S1，皇宫五件真实资产、人物试衣入口与专项检查见[皇宫禁卫与长枪](皇宫禁卫与长枪.md)。S0是已完成的建项阶段；S2至S4尚未实现。\n\n## 目标与边界')
patch(p,'本阶段只建立三类风格','S0建项时只建立三类风格')
patch(p,'`npm run check:soldier` 当前负责保护 S0 契约','`npm run check:soldier` 当前同时检查S1真实资产并保护 S0 契约')
patch(p,'S1 出现第一件可见资产后再加入 `review:soldier` 和 Manual Visual Review 的 soldier scope；S0 不生成“空军人”截图。','S1已加入 `review:soldier` 与 Manual Visual Review 的 soldier scope；普通交互和显式截图分别验证，S0不生成空占位截图。')
patch(p,'主要权重来自 Pelvis 与左右 Thigh','可选作者骨骼来自 Hips 与左右 Thigh；S1各甲片使用对应Thigh刚性权重')
print('S1 integration, visual fixes and current documentation updated')
