# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 작업 프로세스 (Work Process)

### 1. 작업 시작 시 필수 사항

**모든 작업은 To-Do 리스트를 생성하여 진행한다:**
- `TaskCreate`를 사용하여 작업 항목을 생성
- 작업 시작 시 `TaskUpdate`로 상태를 `in_progress`로 변경
- 작업 완료 시 `TaskUpdate`로 상태를 `completed`로 변경
- 복잡한 작업은 세부 태스크로 분리하여 관리

**작업 일지 생성:**
- 모든 작업 세션에서 `.worklog/YYYY-MM-DD.md` 파일에 작업 일지 기록
- 작업 일지에는 다음 내용 포함:
  - 작업 목표 및 요구사항
  - 사용자에게 질문한 내용과 답변
  - 주요 결정 사항과 그 이유
  - 변경된 파일 목록
  - 발생한 이슈 및 해결 방법

### 2. 불명확한 사항 처리

**직접 판단하지 않고 반드시 `AskUserQuestion`을 사용하여 확인:**
- 요구사항이 모호하거나 여러 해석이 가능한 경우
- 기술적 선택지가 여러 개 있는 경우
- 기존 코드의 의도를 파악하기 어려운 경우
- 비즈니스 로직에 대한 도메인 지식이 필요한 경우
- 성능 vs 가독성 등 트레이드오프 결정이 필요한 경우

---

## 코드 컨벤션 (Code Conventions)

### TypeScript 작성 규칙

**타입 파라미터 네이밍:**
```typescript
T   // 요소 타입 (element type)
K   // 키 타입 (key type)
V   // 값 타입 (value type)
E   // 에러 타입 (error type)
R   // 반환 타입 (return type)
```

**타입 안전성:**
```typescript
// 입력 배열은 readonly로 선언하여 의도치 않은 변경 방지
function chunk<T>(arr: readonly T[], size: number): T[][] {
  // ...
}

// Type Guard 패턴 - is 타입 서술어 사용
function isNotNil<T>(x: T | null | undefined): x is T {
  return x != null;
}

// 제네릭 제약조건으로 타입 안전성 확보
function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  // ...
}
```

**명시적 에러 처리:**
```typescript
// 입력값 검증 시 명확한 에러 메시지 제공
function chunk<T>(arr: readonly T[], size: number): T[][] {
  if (size < 1) {
    throw new Error("size must be greater than 0");
  }
  // ...
}
```

### 코드 스타일 원칙

**가독성 우선:**
```typescript
// Bad: reduce 체이닝으로 인한 가독성 저하
const result = arr.reduce((acc, item) => {
  return acc.concat(transform(item).filter(x => x > 0));
}, []);

// Good: for 루프로 명확한 의도 전달
const result: number[] = [];
for (const item of arr) {
  const transformed = transform(item);
  for (const x of transformed) {
    if (x > 0) {
      result.push(x);
    }
  }
}
```

**단순함 추구 (85% 규칙):**
- 가장 흔한 85%의 사용 사례에 대해 단순한 인터페이스 제공
- 엣지 케이스를 위해 핵심 API를 복잡하게 만들지 않음
- 복잡한 기능이 필요하면 별도 함수로 분리

**네이티브 API 우선:**
```typescript
// Bad: 이미 존재하는 기능 재구현
function isArray(value: unknown): value is unknown[] {
  return Object.prototype.toString.call(value) === "[object Array]";
}

// Good: 네이티브 API 사용
Array.isArray(value);
Math.min(...numbers);
Object.keys(obj);
```

### 함수 설계 원칙

**단일 책임:**
```typescript
// 각 함수는 하나의 명확한 작업만 수행
function debounce<F extends (...args: any[]) => void>(
  func: F,
  wait: number
): DebouncedFunction<F> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };

  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };

  return debounced as DebouncedFunction<F>;
}
```

**비파괴적 연산:**
```typescript
// 원본 데이터를 변경하지 않고 새 객체/배열 반환
function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}
```

### JSDoc 문서화

모든 export 함수에 JSDoc 작성:
```typescript
/**
 * 배열을 지정된 크기의 청크로 분할합니다.
 *
 * @template T - 배열 요소의 타입
 * @param {readonly T[]} arr - 분할할 배열
 * @param {number} size - 각 청크의 크기 (1 이상)
 * @returns {T[][]} 청크 배열
 * @throws {Error} size가 1보다 작은 경우
 *
 * @example
 * chunk([1, 2, 3, 4, 5], 2);
 * // => [[1, 2], [3, 4], [5]]
 */
function chunk<T>(arr: readonly T[], size: number): T[][] {
  // ...
}
```

---

## 테스트 전략 (Testing Strategy)

### 테스트 파일 구조

```
src/
├── utils/
│   ├── chunk.ts
│   └── chunk.spec.ts    # 소스 파일과 동일 위치
```

### 테스트 작성 원칙

**경계값 테스트:**
```typescript
describe("chunk", () => {
  it("빈 배열 처리", () => {
    expect(chunk([], 2)).toEqual([]);
  });

  it("size가 배열 길이보다 큰 경우", () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  it("size가 1보다 작으면 에러", () => {
    expect(() => chunk([1, 2, 3], 0)).toThrow();
  });
});
```

**타입 테스트:**
```typescript
// 컴파일 타임 타입 검증
it("타입 추론이 올바르게 동작해야 함", () => {
  const result = chunk([1, 2, 3], 2);
  // result의 타입이 number[][]인지 확인
  expectTypeOf(result).toEqualTypeOf<number[][]>();
});
```

---

## 성능 고려사항 (Performance Considerations)

### 번들 사이즈 최적화

**Tree-shaking 지원:**
- 모든 함수를 named export로 제공
- side-effect 없는 순수 함수 작성
- package.json에 `"sideEffects": false` 명시

**의존성 최소화:**
```typescript
// Bad: 무거운 라이브러리 전체 import
import _ from "lodash";
_.chunk(arr, 2);

// Good: 필요한 함수만 import (es-toolkit 권장)
import { chunk } from "es-toolkit";
chunk(arr, 2);
```

### 런타임 성능

**불필요한 연산 회피:**
```typescript
// Bad: 매번 새 함수 생성
arr.map(item => item.id);

// Good: 재사용 가능한 함수 참조
const getId = (item: Item) => item.id;
arr.map(getId);
```

**조기 반환:**
```typescript
function find<T>(arr: T[], predicate: (item: T) => boolean): T | undefined {
  for (const item of arr) {
    if (predicate(item)) {
      return item; // 찾으면 즉시 반환
    }
  }
  return undefined;
}
```

---

## 아키텍처 원칙 (Architecture Principles)

### Clean Architecture 레이어 구조

```
src/
├── domain/           # 핵심 비즈니스 로직 (프레임워크 독립적)
│   ├── entities/     # 엔티티 - 핵심 비즈니스 객체
│   ├── usecases/     # 유스케이스 - 비즈니스 규칙
│   └── repositories/ # 리포지토리 인터페이스 (추상화)
│
├── application/      # 애플리케이션 서비스 레이어
│   ├── services/     # 유스케이스 조합 및 오케스트레이션
│   ├── dtos/         # 데이터 전송 객체
│   └── mappers/      # 엔티티 <-> DTO 변환
│
├── infrastructure/   # 외부 시스템 연동
│   ├── api/          # API 클라이언트 구현
│   ├── repositories/ # 리포지토리 구현체
│   ├── storage/      # 로컬 스토리지, 캐시
│   └── external/     # 외부 서비스 어댑터
│
├── presentation/     # UI 레이어
│   ├── components/   # UI 컴포넌트
│   ├── pages/        # 페이지/라우트
│   ├── hooks/        # 커스텀 훅
│   └── contexts/     # React Context
│
└── shared/           # 공유 유틸리티
    ├── types/        # 공통 타입 정의
    ├── utils/        # 유틸리티 함수
    └── constants/    # 상수 정의
```

### 레이어별 의존성 규칙

```
[Presentation] → [Application] → [Domain] ← [Infrastructure]
```

- **Domain**: 어떤 레이어에도 의존하지 않음. 순수 TypeScript로 작성
- **Application**: Domain에만 의존. 프레임워크 코드 금지
- **Infrastructure**: Domain 인터페이스를 구현. 외부 라이브러리 사용 가능
- **Presentation**: Application과 Domain 타입에 의존. UI 프레임워크 사용

---

## SOLID 원칙 적용

### S - Single Responsibility Principle (단일 책임 원칙)
- 하나의 클래스/함수/컴포넌트는 하나의 책임만 가진다
- 변경의 이유가 하나만 존재해야 한다

### O - Open/Closed Principle (개방-폐쇄 원칙)
- 확장에는 열려있고, 수정에는 닫혀있어야 한다

```typescript
// 전략 패턴을 활용한 확장 가능한 설계
interface PaymentStrategy {
  pay(amount: number): Promise<PaymentResult>;
}

class CardPayment implements PaymentStrategy { /* ... */ }
class BankTransfer implements PaymentStrategy { /* ... */ }
```

### L - Liskov Substitution Principle (리스코프 치환 원칙)
- 하위 타입은 상위 타입을 대체할 수 있어야 한다

### I - Interface Segregation Principle (인터페이스 분리 원칙)
- 클라이언트가 사용하지 않는 인터페이스에 의존하지 않도록 한다

```typescript
// Good: 분리된 인터페이스
interface Readable { read(): Data; }
interface Writable { write(data: Data): void; }
interface ReadWritable extends Readable, Writable {}
```

### D - Dependency Inversion Principle (의존성 역전 원칙)
- 구현이 아닌 인터페이스에 의존

---

## 신규 기술 스택/라이브러리 도입 프로세스

### 1. 조사 단계
새로운 기술을 도입할 때는 반드시 다음 과정을 거친다:

```
1. WebSearch로 최신 정보 조사
   - "[라이브러리명] [현재년도] best practices"
   - "[라이브러리명] vs [대안] comparison"
   - "[라이브러리명] [현재 프레임워크] integration"

2. 현재 프로젝트와의 호환성 검증
   - package.json의 현재 버전들 확인
   - Node.js 버전 호환성 확인
   - 번들 사이즈 영향 분석
   - TypeScript 버전 호환성 확인

3. 후보군 선정 및 비교 분석
```

### 2. 사용자 확인 (AskUserQuestion 필수)

조사 완료 후 반드시 `AskUserQuestion`을 사용하여 다음 형식으로 추천:

```
## 기술 선택: [카테고리]

### 추천 옵션들

**옵션 1: [라이브러리명] (추천)**
- 장점: ...
- 단점: ...
- 호환성: 현재 프로젝트와 호환 여부
- 번들 사이즈: ...

**옵션 2: [라이브러리명]**
- 장점: ...
- 단점: ...

**옵션 3: 직접 구현**
- 장점: 의존성 없음, 완전한 제어
- 단점: 개발 시간, 유지보수 부담
```

### 3. 도입 시 체크리스트
- [ ] 라이선스 확인 (MIT, Apache 2.0 등 허용 라이선스)
- [ ] 유지보수 상태 확인 (최근 커밋, 이슈 대응)
- [ ] 커뮤니티 규모 확인 (GitHub stars, npm 다운로드)
- [ ] TypeScript 지원 여부
- [ ] 트리쉐이킹 지원 여부
- [ ] 기존 의존성과 충돌 없음 확인

---

## Git 컨벤션 (Git Conventions)

### 커밋 메시지 형식

```
<type>[scope]: <description>
```

**Type (shipping code):**
- `feat` - 새로운 기능
- `fix` - 버그 수정

**Type (non-shipping code):**
- `docs` - 문서 수정
- `test` - 테스트 추가/수정
- `chore` - 빌드, 설정 등 기타 변경

**예시:**
```
feat[chunk]: add chunk function for array splitting
fix[debounce]: fix memory leak on cancel
docs[readme]: update installation guide
```

### PR 작성 규칙

```markdown
## Summary
- 변경 사항 요약 (1-3 bullet points)

## Changes
- 구체적인 변경 내용

## Test Plan
- [ ] 단위 테스트 추가/수정
- [ ] 수동 테스트 완료
```

---

## 프로젝트별 설정

### 현재 프로젝트 정보

**Repository**: Frontend Fundamentals (FF)
- VitePress 문서 사이트 + React SPA 모노레포
- 사이트: https://frontend-fundamentals.com/

**Tech Stack:**
- Package Manager: Yarn 4.6.0 (PnP)
- Node: 22+
- Documentation: VitePress 1.4.1
- React App: Vite 5, React 18, TypeScript 5.6+
- Testing: Jest 30
- Linting: Oxlint

### 개발 명령어

```bash
# 의존성 설치
yarn install

# 문서 사이트 개발
yarn docs:dev              # Code Quality docs
yarn docs:bundle:dev       # Bundling docs
yarn docs:a11y:dev         # Accessibility docs
yarn docs:debug:dev        # Debug docs
yarn docs:til:dev          # Today I Learned React app

# 전체 빌드
yarn build

# Today I Learned 워크스페이스
cd fundamentals/today-i-learned
yarn dev                   # 개발 서버
yarn test                  # Jest 테스트
yarn lint                  # Oxlint
yarn typecheck             # TypeScript 검사
```

---

## 작업 일지 템플릿

`.worklog/YYYY-MM-DD.md` 형식으로 생성:

```markdown
# 작업 일지 - YYYY-MM-DD

## 작업 목표
- [ ] 목표 1
- [ ] 목표 2

## 질문 및 답변
### Q1: [질문 내용]
**답변**: [사용자 답변]
**결정**: [결정 사항]

## 작업 내역
### [시간] - [작업 제목]
- 변경 파일: `path/to/file.ts`
- 작업 내용: ...
- 비고: ...

## 발생 이슈
### 이슈 1: [이슈 제목]
- 원인: ...
- 해결: ...

## 다음 작업
- [ ] 후속 작업 1
- [ ] 후속 작업 2
```
