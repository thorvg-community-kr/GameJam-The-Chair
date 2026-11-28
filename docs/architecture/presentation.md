# 프레젠테이션

프레젠테이션은 코어 snapshot과 `GameEvent`를 입력으로 받습니다. 화면 효과는 게임 판정에 다시 들어가지 않습니다.

## 렌더링 경로

`createRenderer()`는 두 canvas를 사용합니다.

| 레이어 | 기술 | 내용 |
|---|---|---|
| base | Canvas2D | ThorVG를 사용할 수 없을 때 벡터 장면을 대신 그림 |
| tvg | ThorVG WebCanvas | 게임의 절차적 벡터 장면 |

DOM은 집중력, 메뉴, 터치 컨트롤, 종료 panel처럼 조작과 접근성이 필요한 HUD만 담당합니다. 플레이어 반응, 1스테이지 동료 대사, 스테이지 제목 카드는 `scene/shared/talk.ts`가 ThorVG 말풍선과 Text로 그립니다.

`renderer.draw()`는 snapshot과 effect를 mutable `RenderCtx`에 넣고 camera, scale, vertical offset을 계산합니다. 현재 스테이지에 따라 `drawWorld()`, `drawBuilding()`, `drawRooftop()`, `drawCloudStart()`, `drawOrbit()`를 호출합니다. 선택 기준은 `src/presentation/stages.ts`입니다.

장면 함수는 `RenderCtx`의 polygon, path, gradient, layer helper를 호출합니다. helper는 화면 좌표의 `DrawCommand[]`를 만듭니다. `paint()`는 명령을 ThorVG `Shape`와 `Scene`으로 변환하고 `Canvas.update().render()`를 실행합니다.

## ThorVG 사용 범위

게임 장면은 다음 ThorVG 기능을 사용합니다.

- cubic path, fill, stroke, dash, linear·radial gradient
- trim path, opacity, blend
- scene grouping, clip path, alpha mask
- Gaussian blur와 motion blur
- shape와 scene pool을 통한 프레임 간 객체 재사용
- `Text`와 `Font.load()`: 장면 속 모든 글자. `DrawCommand`의 `text`로 들어가 앞뒤 도형과 그리기 순서가 맞습니다.

글꼴은 세 가지 OFL 글꼴의 subset입니다(`src/render/fonts.ts`). Black Han Sans는 간판과 복사기 외침, Do Hyeon은 표지와 안내(`ctx.label`), Jua는 말풍선에 씁니다. 어느 글꼴에도 없는 `…`, `·`는 `fitGlyphs()`가 바꾸고, `♪`는 말풍선이 벡터 음표로 그립니다. 문구를 바꾸면 `node scripts/subset-fonts.mjs`(fontTools 필요)로 subset을 다시 만들고, `tests/font-coverage.test.mjs`가 글리프 누락을 검사합니다. 글자 너비는 ThorVG가 로드된 뒤 `Text.bounds()`로 잽니다.

시작 화면은 별도 ThorVG `Animation`으로 `assets/powred.by.thorvg.1.json` Lottie 파일을 재생합니다.

5스테이지 엔딩 크레딧(`scene/orbit/credits.ts`)은 같은 Lottie를 게임 canvas 안에서 다시 씁니다. `DrawCommand`의 `lottie` 명령은 ThorVG `Animation.picture`를 layer Scene에 넣고 엔딩 시간으로 `seek()`합니다. `LayerSpec.holdsText`를 켠 layer는 text와 Lottie도 자기 Scene 안에 넣으므로, 크레딧 열의 그라디언트 alpha mask가 글자와 로고에 함께 적용됩니다. 이 layer 안에서는 path가 text·Lottie보다 아래에 그려집니다. Lottie JSON은 `render/thorvg.ts`가 글꼴과 함께 불러오며, 불러오기 전이나 Canvas2D fallback에서는 로고 대신 `Powered by ThorVG` 글자를 씁니다.

크레딧 내용은 `scene/orbit/credits-data.ts`의 데이터만 고치면 됩니다. 라벨과 라이선스 줄은 항상 보이고, 비어 있는 이름 칸은 아무것도 그리지 않으며 자리도 차지하지 않습니다. 크레딧이 끝나는 시점은 내용 높이와 고정 스크롤 속도로 계산되므로 이름을 채우면 자동으로 길어집니다. 새 라벨을 넣으면 글꼴 subset을 다시 만듭니다. 크레딧이 끝나고 1초 뒤 `main.ts`가 `closeCredits` 명령을 보내고, 건너뛰기 버튼과 크레딧 중 `Esc`도 같은 명령을 보냅니다. 명령은 기록되므로 리플레이도 같은 시점에 타이틀로 돌아갑니다.

Canvas2D fallback은 기본 path, fill, stroke, gradient, blend를 그립니다. alpha mask, motion blur, trim path는 재현하지 않으며 group 효과도 ThorVG와 완전히 같지 않습니다. fallback은 게임 진행을 유지하기 위한 경로이지 시각적 동등성 검사가 아닙니다.

## 장면과 paint 객체

스테이지 장면은 `src/render/scene`에 있습니다. 공용 캐릭터와 물, 청소부, 소화기 분사 같은 요소는 별도 모듈로 분리되어 있습니다.

`RenderCtx`는 offset, rotation, scale, mirror, 현재 layer를 공유합니다. 장면 helper는 바꾼 값을 호출 범위 안에서 복구해야 합니다. layer는 중첩 stack이 아니므로 `beginLayer()`와 `endLayer()`를 겹쳐 사용하지 않습니다.

A `kind: 'group'` command wraps every command, text and layer up to its closing marker (`group: null`) in one ThorVG `Scene` and applies a single clip or mask to that Scene. Layers inside a group get their own Scenes keyed by the group prefix, so a layer moving in and out of a group never shares a Scene. The opening iris draws the clock without masks and then covers it with the office inside one circular alpha-mask group. The GL engine re-applies a Scene clip for every child shape, so groups with many children use a mask instead of a clip. Clock commands that lie entirely inside the iris circle are dropped before painting.

`paint/commands.ts`는 순서를 유지하며 인접한 호환 layer를 묶습니다. `paint/thorvg.ts`는 shape, text, scene 풀을 재사용합니다. 새 paint 속성을 추가하면 다음 프레임에 이전 값이 남지 않도록 reset 처리도 추가해야 합니다. 카메라와 바퀴 회전은 이전 draw 결과를 사용하며, 스테이지 변경이나 시간 역행에서 초기화됩니다.

### Incremental cutscene updates

The opening and the parked orbit ending opt into incremental ThorVG updates.
The paint pool keeps each Scene and compares path coordinates, paint, text,
Lottie properties, filters, clipping, and masks with its last applied values.
Only changed properties cross into ThorVG. Coordinate snapshots store numbers
directly, including copies of nested coordinates, so in-place edits and backwards
seeks are detected without serializing path numbers.

Leaving these cutscenes clears the comparison cache. Ordinary gameplay and the
Canvas2D fallback keep their existing update paths. Removing a clip or mask still
replaces its Scene because ThorVG cannot detach them. Commands are still built
each frame, and camera-dependent projected geometry still updates when it moves;
this does not cache an entire cutscene as a bitmap.

## 효과, 피드백, 다국어

`createEffects()`는 copier flash, 물, 입자, glare 같은 시각 상태를 관리합니다. 효과는 코어 상태 관찰, `GameEvent`, 프레임 시간 진행으로 갱신되며 물 효과도 자체 결정적 RNG를 사용합니다. 효과의 물 위치를 충돌이나 집중력 판정에 사용하지 않습니다.

`createFeedback()`은 cue 이벤트를 대사, 상태 알림, 종료 panel로 바꿉니다. 메시지 key를 저장하고 snapshot을 만들 때 현재 locale로 번역합니다. `createHud()`는 game, feedback, effect snapshot을 DOM에 반영합니다.

정적 DOM 문구는 `main.ts`의 `applyLocale()`이 `[data-i18n]`과 `[data-i18n-aria]`에 적용합니다. 새 문구는 `src/i18n.ts`에 영어와 한국어를 함께 추가합니다.

## 배경음악

`src/presentation/music.ts`의 `musicTrack`이 화면 상태로 곡을 고릅니다. 시작 화면은 `start`, 오프닝(프롤로그) 컷신 동안에는 `null`을 돌려주어 음악 없이 연출만 보여 줍니다. 1·2 스테이지는 `stage1-2`, 3은 `stage3`, 4는 `stage4`, 5는 `stage5`, 궤도 문에 도착한 엔딩은 `ending`이며, 크레딧이 끝나는 순간 소리가 사라지도록 그보다 페이드 시간(1.2초)만큼 먼저 `null`로 바뀝니다. 타이틀로 돌아오면 `start`가 다시 재생됩니다. `src/ui/music.ts`는 곡을 반복 재생하고 1.2초 동안 크로스페이드하며, 일시정지 중에는 볼륨을 낮춥니다. 곡이 `null`이면 재생 중인 곡을 모두 페이드 아웃하고, 컷신이 끝나거나 건너뛰면 그 화면의 곡이 다시 페이드 인됩니다. 스플래시(`src/ui/splash.ts`)가 보이는 동안에는 어떤 곡도 요청하지 않습니다. 로고가 끝나면 바로 타이틀로 넘어가며 `main.ts`가 `music.play('start')`를 호출합니다. 브라우저는 사용자 입력 전의 소리 재생을 막으므로, 입력이 한 번도 없었다면 곡은 막힌 채 볼륨 0으로 기다리다가 첫 클릭·탭·키 입력에서 설정 음량(전체 × 배경음)까지 페이드 인됩니다(막힌 동안 `advance()`가 볼륨을 미리 올리지 않음). 로고 도중 클릭·탭·키로 건너뛰면 그 입력 이벤트 안에서 `sfx.unlock()`으로 효과음 `AudioContext`를 깨우고 `start` 곡을 재생하므로 타이틀이 나타나는 순간 음악이 들립니다. 건너뛰기 입력은 `window`에서 받으므로 화면 어디를 눌러도, 포커스가 다른 곳에 있어도 동작하며, 스플래시 동안에는 루트의 `splashing` 클래스로 모바일 가로 조작 버튼을 숨깁니다. `?stage=N`으로 바로 들어가면 스플래시가 없으므로 첫 입력 뒤에 소리가 납니다. 음원은 모든 브라우저에서 재생되는 AAC `assets/bgm/*.m4a`(80 kbps)입니다.

## 모션 확인

`src/preview-scenes.ts`의 등록 항목은 id, label, 지연 생성 함수 `create()`를 제공합니다. `preview/registration.ts`는 선택한 장면을 처음 한 번 만들고 캐시합니다. 생성된 각 `PreviewScene`은 시간에 따른 `{ state, effects }`를 반환합니다. 실제 코어를 기록하는 장면은 화면 한 프레임마다 120 Hz 틱 두 번을 실행해 60 Hz frame을 만듭니다. 직접 만든 장면도 같은 시간에 항상 같은 snapshot을 반환해야 합니다.

모션을 추가하거나 바꾸면 preview registry에 장면을 등록하고 `/preview.html`에서 재생, 역방향 seek, 주요 marker를 확인합니다. `motion`과 `t` query parameter로 같은 장면과 시간을 공유할 수 있습니다.

## 현재 장면 폴더와 백엔드

`render/scene`은 `office`, `building`, `rooftop`, `sky`, `orbit`, `opening`, `player`, `personal-box`, `effects`, `shared`로 나뉩니다. 스테이지의 `index.ts`는 실제 장면 구현을 포함합니다. 사무실은 `office/world.ts`, 구름 장면은 `sky/clouds.ts`에서 시작합니다.

`render/thorvg.ts`는 WASM과 글꼴을 로드합니다. 자동 선택은 하드웨어 WebGL2를 사용하고 알려진 소프트웨어 GL 구현을 제외합니다. `?renderer=gl` 또는 `?renderer=sw`로 ThorVG 백엔드를 지정할 수 있습니다. ThorVG 소프트웨어 렌더링과 Canvas2D 대체 경로는 서로 다릅니다.

유지되는 도형의 geometry 식별자와 scene transform을 이용해 도형을 재사용합니다. clip이나 mask를 안전하게 해제할 수 없는 경우 scene을 교체합니다. 화면 밖 도형 제거와 effect budget은 layer 처리 범위를 제한합니다. 성능 정보와 layer 제어는 `render/perf.ts`, `ui/perf-overlay.ts`에서 확인합니다.
