markdown# HealthWatch System 

실시간 환자 모니터링 시스템 - 병원/요양시설용

## 프로젝트 소개

환자의 생체신호를 실시간으로 모니터링하고 위험 상황 발생 시 자동으로 알림을 보내는 시스템입니다.
WebSocket 기반 실시간 통신으로 의료진이 언제 어디서나 환자 상태를 확인할 수 있습니다.

### 주요 기능

- 실시간 생체신호 모니터링 (심박수, 혈압, 체온, 산소포화도)
- 위험 수치 자동 감지 및 알림
- 환자 정보 관리 (등록, 수정, 조회)
- 생체신호 데이터 분석 및 시각화
- 역할 기반 접근 제어 (의사/간호사/기술자)

## 기술 스택

### Backend
- Node.js + Express.js
- TypeScript
- PostgreSQL (메인 DB)
- Redis (캐시 & 세션)
- Elasticsearch (로그 분석)
- Socket.IO (실시간 통신)
- GraphQL + REST API

### Frontend
- React 18 + TypeScript
- Tailwind CSS
- Recharts 
- Socket.IO Client
- React Router

### Infrastructure
- Docker & Docker Compose
- Nginx
- AWS 
