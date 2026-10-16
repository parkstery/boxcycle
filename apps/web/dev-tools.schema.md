# dev-tools.json

`scripts/check-dev-tools.mjs` 가 읽는 개발 부산물 등록부.

| 필드 | 내용 |
|---|---|
| `id` | 짧은 이름. 항목마다 다르게 |
| `kind` | `module` · `query` · `script` |
| `path` | `module`·`script`. 저장소 상대 경로 |
| `key` | `query`. 주소 스위치 이름 |
| `class` | `product` · `permanent` · `temporary` |
| `purpose` | 한 줄 |
| `enable` | 켜는 법 |
| `bundle` | 만든 작업 묶음 폴더 |
| `added` | `YYYY-MM-DD` |
| `expires` | `temporary` 만. `YYYY-MM-DD` |

시험 파일과, package.json·다른 코드·e2e·훅이 부르는 스크립트는 등록하지 않아도 된다.
