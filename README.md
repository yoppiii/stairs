# 부기의 계단 (Boogie Stairs)

아이와 함께 만드는 iPad 최적화 웹 게임입니다.
기본 룰은 `무한의 계단` 스타일로, 다음 계단의 방향(왼쪽/오른쪽)을 맞춰 무한히 올라가는 방식입니다.

## 기술 선택
- 정적 웹(HTML/CSS/Vanilla JS)
- 서버 없이 동작 (운영 단순)
- GitHub Pages로 자동 배포
- iPad 터치 조작 최적화

## 게임 규칙
- 시작 후 계단은 좌/우로 번갈아 생성됩니다.
- 플레이어는 `왼쪽` 또는 `오른쪽`을 선택해 다음 계단으로 이동합니다.
- 방향을 틀리면 즉시 게임 오버입니다.
- 아래의 위험 라인이 계속 올라오므로, 빠르게 입력해야 합니다.
- 한 칸 올라갈 때마다 점수 +1.
- 최고 점수는 브라우저 `localStorage`에 저장됩니다.

## 로컬 실행
정적 파일이라 간단한 서버만 있으면 됩니다.

```bash
cd /Users/yoppiii/Documents/Boogie_stairs
python3 -m http.server 8080
```

브라우저에서 `http://localhost:8080` 접속.

## GitHub 업로드
```bash
cd /Users/yoppiii/Documents/Boogie_stairs
git init
git add .
git commit -m "feat: bootstrap boogie stairs web game"
git branch -M main
git remote add origin <YOUR_REPO_URL>
git push -u origin main
```

## GitHub Pages 배포
이미 `.github/workflows/deploy-pages.yml`가 포함되어 있습니다.

1. GitHub 저장소 `Settings > Pages` 이동
2. Source를 `GitHub Actions`로 선택
3. `main` 브랜치에 푸시하면 자동 배포

## 운영 팁
- 운영 부담을 줄이려면 정적 파일 구조 유지(서버리스)
- 업데이트는 `main` 브랜치 커밋/푸시만으로 반영
- 아이 테스트 시 난이도 조절은 `game.js`의 `dangerSpeed` 계산식만 조정하면 됩니다.
