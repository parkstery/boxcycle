# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-redesign-batch4.spec.ts >> 맵 뷰 기본 높이·고급·Chief 고정9
- Location: e2e\ui-redesign-batch4.spec.ts:169:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 60
Received:   60

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e3]:
  - img [ref=e4]
  - generic: 검수용 지도 배경 · 실제 제품 컴포넌트 · 서버 기록 없음
  - generic:
    - generic "경로 보기":
      - button "경로 패널 펼치기" [ref=e10] [cursor=pointer]:
        - img
    - group "경로 미니맵" [ref=e11]:
      - img "전체 경로와 현재 위치" [ref=e12]:
        - img [ref=e13]
      - button "미니맵 접기" [expanded] [ref=e30] [cursor=pointer]:
        - img [ref=e31]
  - group "주행 제어" [ref=e33]:
    - 'button "케이던스 센서: 연결됨, 72 rpm" [ref=e34] [cursor=pointer]'
    - button "일시정지" [ref=e36] [cursor=pointer]
    - button "주행 종료" [ref=e37] [cursor=pointer]
  - generic "라이딩 HUD":
    - button "Trail 메뉴" [ref=e38] [cursor=pointer]
    - button "맵 뷰 설정" [expanded] [ref=e39] [cursor=pointer]: 맵 뷰
    - group "주행 지표" [ref=e44]:
      - generic "주행 누적 거리 / 경로 전체거리" [ref=e45]:
        - generic [ref=e46]: 거리
        - generic "주행 누적 거리" [ref=e47]:
          - text: "4.20"
          - generic [ref=e48]: / 10.00
          - generic [ref=e49]: km
      - generic "시간" [ref=e50]:
        - generic [ref=e51]: 시간
        - generic [ref=e52]: 24:08
      - generic "평균" [ref=e53]:
        - generic [ref=e54]: 평균
        - generic [ref=e55]:
          - text: "18.6"
          - generic [ref=e56]: km/h
      - generic "속도" [ref=e57]:
        - generic [ref=e58]: 속도
        - generic [ref=e59]:
          - text: "24"
          - generic [ref=e60]: km/h
      - status "이번 주행에서 새로 밟은 도로(이미 내 도로면 0)" [ref=e61]:
        - generic [ref=e62]: 새 도로
        - generic [ref=e63]:
          - text: "+0.42"
          - generic [ref=e64]: km
    - generic [ref=e65]:
      - button "전체" [ref=e67] [cursor=pointer]:
        - generic [ref=e69]: 전체
        - generic [ref=e70]: ▾
      - group "맵 제어" [ref=e71]:
        - button "맵 스타일 위성, 클릭 시 야외" [ref=e72] [cursor=pointer]: 위성
        - button "줌 확대" [ref=e73] [cursor=pointer]: +
        - button "줌 축소" [ref=e74] [cursor=pointer]: −
      - button "사용자 정보" [ref=e75] [cursor=pointer]:
        - generic [ref=e76]: G
    - time: 26.10.25 / 06:53:27
    - generic:
      - status:
        - generic: 다리에 힘을 빼요. 몸을 느슨하게 해요.
  - generic:
    - button
    - dialog:
      - generic:
        - tablist:
          - tab [selected]: 오늘
          - tab: 주간
          - tab: 월간
          - tab: 연간
        - generic:
          - generic: 10월 25일
          - paragraph:
            - generic: 오늘 주행이 없어요
          - paragraph: 달리면 여기에 거리가 쌓여요
      - generic:
        - generic:
          - button:
            - img
        - generic:
          - group:
            - generic:
              - text: 내 도로망
              - generic: 첫 라이딩으로 나만의 길을 남겨보세요.
            - generic:
              - generic: "0.0"
              - generic: km
          - button:
            - generic: 마지막 주행
            - generic:
              - generic: 아직 주행이 없어요
              - generic:
                - img
          - group:
            - generic: 플랜
            - generic: 게스트 · 회원 등록하면 어느 기기에서나 이어져요
        - generic:
          - button: 회원 등록
  - dialog "맵 뷰" [ref=e77]:
    - button "닫기" [ref=e78] [cursor=pointer]
    - generic [ref=e79]:
      - generic [ref=e80]:
        - generic [ref=e81]: 맵 뷰
        - button "맵 뷰 닫기" [ref=e82] [cursor=pointer]:
          - img [ref=e83]
      - generic [ref=e85]:
        - generic [ref=e86]: 내 도로망
        - generic [ref=e88]:
          - button "전체 도로망" [ref=e89] [cursor=pointer]
          - button "신규 도로만" [disabled] [ref=e90]
      - generic [ref=e91]:
        - generic [ref=e92]: 지도
        - generic "지도 기울기와 3D 건물 표시" [ref=e94] [cursor=pointer]:
          - switch "3D 뷰" [ref=e95]
          - text: 3D 뷰
      - group [ref=e96]:
        - generic "고급 설정" [ref=e97] [cursor=pointer]:
          - strong [ref=e99]: 고급 설정
        - generic [ref=e100]:
          - generic [ref=e101]:
            - generic [ref=e102]: 노선
            - generic [ref=e104]:
              - button "끔" [ref=e105] [cursor=pointer]
              - button "도로 비교" [ref=e106] [cursor=pointer]
          - generic [ref=e107]:
            - generic [ref=e108]: 거리
            - generic [ref=e109]:
              - button "거리 한 눈금 가깝게" [ref=e110] [cursor=pointer]: −
              - generic [ref=e111]: 60.0m
              - button "거리 한 눈금 멀게" [active] [ref=e112] [cursor=pointer]: +
              - slider "거리 60.0m" [ref=e113]: "60"
  - generic:
    - button
    - dialog:
      - generic:
        - generic:
          - generic: Spinatlas
        - button:
          - img
      - generic:
        - complementary:
          - generic: 경로
          - list:
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 입문 경로
                - generic: 처음이라면
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 퍼블릭 경로
                - generic: 다른 라이더가 만든 길
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 내 경로
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 지명 검색
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 순위
                - generic: 이번 주 2위
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 주행 설정
                - img
```

# Test source

```ts
  95  |   await expect(dialog.getByText('82 rpm', { exact: false })).toBeVisible();
  96  |   await expect(dialog.getByRole('button', { name: '센서 없음', exact: true })).toBeVisible();
  97  |   await expect(dialog.getByRole('slider', { name: '세션 속도 km/h' })).toHaveCount(0);
  98  | });
  99  | 
  100 | test('BLE 미지원 브라우저 안내', async ({ page }) => {
  101 |   await page.setViewportSize({ width: 800, height: 360 });
  102 |   await page.goto(`${preview}?state=sensor-unsupported`);
  103 |   const dialog = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  104 |   await expect(dialog.getByText('Web Bluetooth', { exact: false })).toBeVisible();
  105 | });
  106 | 
  107 | test('센서·속도 접근성 이름 유지', async ({ page }) => {
  108 |   await page.setViewportSize({ width: 800, height: 360 });
  109 |   await page.goto(`${preview}?state=sensor`);
  110 |   const dialog = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  111 |   await dialog.getByRole('button', { name: '센서 없음', exact: true }).click();
  112 |   await expect(dialog.getByRole('button', { name: '센서 설정 닫기', exact: true })).toBeVisible();
  113 |   await expect(dialog.getByRole('spinbutton', { name: '속도 km/h', exact: true })).toBeVisible();
  114 | });
  115 | 
  116 | test('프로필 게스트·닉네임 잠금·체중 저장', async ({ page }) => {
  117 |   await page.setViewportSize({ width: 800, height: 360 });
  118 |   await page.goto(`${preview}?state=profile-guest`);
  119 |   const guest = page.getByRole('dialog', { name: '프로필 수정', exact: true });
  120 |   await expect(guest.getByText('게스트는 닉네임이 없습니다', { exact: false })).toBeVisible();
  121 |   await expect(guest.getByRole('textbox', { name: '닉네임', exact: true })).toHaveCount(0);
  122 | 
  123 |   await page.goto(`${preview}?state=profile-locked`);
  124 |   const locked = page.getByRole('dialog', { name: '프로필 수정', exact: true });
  125 |   const nickname = locked.getByRole('textbox', { name: '닉네임', exact: true });
  126 |   await expect(nickname).toBeDisabled();
  127 |   await expect(locked.getByText('닉네임은', { exact: false })).toBeVisible();
  128 | 
  129 |   await page.goto(`${preview}?state=profile`);
  130 |   const fixture = page.locator('#batch4-fixture');
  131 |   const profile = page.getByRole('dialog', { name: '프로필 수정', exact: true });
  132 |   await expect(fixture).toHaveAttribute('data-weight-kg', '64');
  133 |   await expect(fixture).toHaveAttribute('data-intensity-id', 'moderate');
  134 |   await profile.getByRole('spinbutton', { name: '체중(kg)', exact: true }).fill('65');
  135 |   const moderate = profile.getByRole('button', { name: '보통', exact: true });
  136 |   await expect(moderate).toHaveAttribute('aria-pressed', 'true');
  137 |   await profile.getByRole('group', { name: '운동 강도' }).getByRole('button', { name: '강함', exact: true }).click();
  138 |   await profile.getByRole('button', { name: '저장', exact: true }).click();
  139 |   await expect(profile).toBeHidden();
  140 |   await expect(fixture).toHaveAttribute('data-weight-kg', '65');
  141 |   await expect(fixture).toHaveAttribute('data-intensity-id', 'hard');
  142 |   await expect(fixture).toHaveAttribute('data-profile-weight-calls', '1');
  143 | });
  144 | 
  145 | test('주행 설정은 체중·강도 편집 없이 switch·프로필 진입', async ({ page }) => {
  146 |   await page.setViewportSize({ width: 800, height: 360 });
  147 |   await page.goto(`${preview}?state=settings`);
  148 |   const fixture = page.locator('#batch4-fixture');
  149 |   const settings = page.getByRole('dialog', { name: '주행 설정', exact: true });
  150 |   await expect(settings.getByRole('spinbutton')).toHaveCount(0);
  151 |   await expect(settings.getByRole('group', { name: '운동 강도' })).toHaveCount(0);
  152 |   await expect(settings.getByText('체중 64 kg', { exact: false })).toBeVisible();
  153 |   await expect(settings.getByText('운동 강도 보통', { exact: false })).toBeVisible();
  154 |   const switches = settings.getByRole('switch');
  155 |   await expect(switches).toHaveCount(4);
  156 |   await switches.nth(0).click();
  157 |   await switches.nth(1).click();
  158 |   await switches.nth(2).click();
  159 |   await switches.nth(3).click();
  160 |   await expect(fixture).toHaveAttribute('data-ride-coaching', '0');
  161 |   await expect(fixture).toHaveAttribute('data-ride-tts', '0');
  162 |   await expect(fixture).toHaveAttribute('data-ride-bgm', '0');
  163 |   await expect(fixture).toHaveAttribute('data-pacer', '0');
  164 |   await settings.getByRole('button', { name: '프로필 수정', exact: true }).click();
  165 |   await expect(fixture).toHaveAttribute('data-settings-profile-nav-calls', '1');
  166 |   await expect(page.getByRole('dialog', { name: '프로필 수정', exact: true })).toBeVisible();
  167 | });
  168 | 
  169 | test('맵 뷰 기본 높이·고급·Chief 고정9', async ({ page }) => {
  170 |   await page.setViewportSize({ width: 800, height: 360 });
  171 |   await page.goto(`${preview}?state=map`);
  172 |   const fixture = page.locator('#batch4-fixture');
  173 |   const map = page.getByRole('dialog', { name: '맵 뷰', exact: true });
  174 |   expect((await page.locator('.map-view-sheet__panel').boundingBox())!.height).toBeLessThanOrEqual(210);
  175 |   await expect(map.getByText('free', { exact: true })).toBeHidden();
  176 |   await expect(map.getByText('OSRM', { exact: true })).toBeHidden();
  177 |   await expect(map.getByText('Spinatlas Dark', { exact: true })).toBeHidden();
  178 |   await expect(map.getByText('야외', { exact: true })).toHaveCount(0);
  179 |   await expect(map.getByText('위성', { exact: true })).toHaveCount(0);
  180 |   await expect(map.getByRole('button', { name: '맵 뷰 닫기', exact: true })).toBeVisible();
  181 |   await map.locator('.map-view-sheet__check input[role="switch"]').click();
  182 |   await expect(fixture).toHaveAttribute('data-map-enable3d', '1');
  183 |   await map.locator('summary').filter({ hasText: '고급 설정' }).click();
  184 |   await map.getByRole('button', { name: '도로 비교', exact: true }).click();
  185 |   await expect(fixture).toHaveAttribute('data-map-coverage', 'osrm');
  186 |   await map.getByRole('button', { name: '전체 도로망', exact: true }).click();
  187 |   await map.getByRole('button', { name: '신규 도로만', exact: true }).click();
  188 |   await expect(fixture).toHaveAttribute('data-map-conquest', 'recent');
  189 | 
  190 |   await page.goto(`${preview}?state=map&riding`);
  191 |   const ridingMap = page.getByRole('dialog', { name: '맵 뷰', exact: true });
  192 |   await ridingMap.locator('summary').filter({ hasText: '고급 설정' }).click();
  193 |   const initialDistance = Number(await fixture.getAttribute('data-map-camera-m'));
  194 |   await ridingMap.getByRole('button', { name: '거리 한 눈금 멀게', exact: true }).click();
> 195 |   await expect.poll(async () => Number(await fixture.getAttribute('data-map-camera-m'))).toBeGreaterThan(initialDistance);
      |                                                                                          ^ Error: expect(received).toBeGreaterThan(expected)
  196 | });
  197 | 
  198 | 
  199 | test('센서 선택 완료는 준비 상태로 닫히며 주행하지 않는다', async ({ page }) => {
  200 |   await page.goto(`${preview}?state=sensor-connected`);
  201 |   const dialog = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  202 |   await dialog.getByRole('button', { name: '이 센서로 달리기', exact: true }).click();
  203 |   await expect(dialog).toBeHidden();
  204 |   await expect(page.locator('#batch4-fixture')).toHaveAttribute('data-ui-stage', 'ready-to-start');
  205 | });
  206 | 
```