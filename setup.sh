#!/bin/bash

# HealthWatch Pro 프로젝트 자동 설정 스크립트
echo "🏥 HealthWatch Pro 프로젝트 설정을 시작합니다..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수 정의
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 필수 도구 확인
check_requirements() {
    print_status "필수 도구 확인 중..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js가 설치되어 있지 않습니다. https://nodejs.org에서 다운로드하세요."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker가 설치되어 있지 않습니다. https://docker.com에서 다운로드하세요."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose가 설치되어 있지 않습니다."
        exit 1
    fi
    
    print_success "모든 필수 도구가 설치되어 있습니다."
}

# 프로젝트 구조 생성
create_project_structure() {
    print_status "프로젝트 구조 생성 중..."
    
    # 백엔드 디렉토리 구조
    mkdir -p backend/src/{controllers,models,routes,services,middleware,config,graphql,utils,scripts}
    mkdir -p backend/tests/{unit,integration}
    mkdir -p backend/uploads
    
    # 프론트엔드 디렉토리 구조  
    mkdir -p frontend/src/{components,pages,contexts,hooks,services,utils,types,styles}
    mkdir -p frontend/public/images
    
    # 인프라 디렉토리
    mkdir -p infrastructure/{docker,aws,nginx,monitoring}
    
    # 문서 디렉토리
    mkdir -p docs/{api,deployment,user-guide}
    
    # 기타 필요한 파일들
    mkdir -p logs
    mkdir -p scripts
    
    print_success "프로젝트 구조가 생성되었습니다."
}

# 환경 변수 파일 생성
setup_environment() {
    print_status "환경 변수 파일 설정 중..."
    
    # 백엔드 .env 파일
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        print_success "Backend .env 파일이 생성되었습니다."
        print_warning "backend/.env 파일을 열어서 환경 변수를 수정하세요."
    else
        print_warning "Backend .env 파일이 이미 존재합니다."
    fi
    
    # 프론트엔드 .env 파일 (필요시)
    if [ ! -f "frontend/.env" ]; then
        cat > frontend/.env << EOL
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_VERSION=1.0.0
EOL
        print_success "Frontend .env 파일이 생성되었습니다."
    fi
}

# TypeScript 설정
setup_typescript() {
    print_status "TypeScript 설정 중..."
    
    # Backend tsconfig.json
    if [ ! -f "backend/tsconfig.json" ]; then
        cat > backend/tsconfig.json << EOL
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "tests"
  ]
}
EOL
        print_success "Backend TypeScript 설정이 완료되었습니다."
    fi
}

# Git 설정
setup_git() {
    print_status "Git 설정 중..."
    
    if [ ! -f ".gitignore" ]; then
        cat > .gitignore << EOL
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.production
.env.test

# Build outputs
/backend/dist/
/frontend/build/
/frontend/.next/

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# Database
*.db
*.sqlite

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo

# Temporary folders
tmp/
temp/

# Docker
.dockerignore

# AWS
.aws/

# Uploads
uploads/
*.csv
*.xlsx

# Redis dump
dump.rdb
EOL
        print_success ".gitignore 파일이 생성되었습니다."
    fi
    
    if [ ! -d ".git" ]; then
        git init
        git add .
        git commit -m "Initial commit: HealthWatch Pro project setup"
        print_success "Git 저장소가 초기화되었습니다."
    fi
}

# Docker 설정 검증
validate_docker() {
    print_status "Docker 설정 검증 중..."
    
    if docker-compose config > /dev/null 2>&1; then
        print_success "Docker Compose 설정이 유효합니다."
    else
        print_error "Docker Compose 설정에 오류가 있습니다."
        return 1
    fi
}

# 의존성 설치
install_dependencies() {
    print_status "의존성 설치 중..."
    
    # 백엔드 의존성
    print_status "백엔드 의존성 설치 중..."
    cd backend
    npm install
    cd ..
    print_success "백엔드 의존성 설치 완료"
    
    # 프론트엔드 의존성 (create-react-app이 이미 실행된 경우)
    if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
        print_status "프론트엔드 의존성 설치 중..."
        cd frontend
        npm install
        cd ..
        print_success "프론트엔드 의존성 설치 완료"
    fi
}

# 데이터베이스 초기화 스크립트
create_db_init_script() {
    print_status "데이터베이스 초기화 스크립트 생성 중..."
    
    cat > scripts/init-db.sh << EOL
#!/bin/bash
echo "데이터베이스 초기화 중..."

# Wait for PostgreSQL to be ready
until docker-compose exec postgres pg_isready -U postgres; do
  echo "PostgreSQL이 준비될 때까지 대기 중..."
  sleep 2
done

# Run database initialization
docker-compose exec postgres psql -U postgres -d healthwatch -f /docker-entrypoint-initdb.d/init.sql

echo "데이터베이스 초기화 완료"
EOL
    
    chmod +x scripts/init-db.sh
    print_success "데이터베이스 초기화 스크립트가 생성되었습니다."
}

# 개발 도구 설정
setup_dev_tools() {
    print_status "개발 도구 설정 중..."
    
    # ESLint 설정 (Backend)
    if [ ! -f "backend/.eslintrc.js" ]; then
        cat > backend/.eslintrc.js << EOL
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  extends: [
    '@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
EOL
        print_success "Backend ESLint 설정이 생성되었습니다."
    fi
    
    # Prettier 설정
    if [ ! -f ".prettierrc" ]; then
        cat > .prettierrc << EOL
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
EOL
        print_success "Prettier 설정이 생성되었습니다."
    fi
}

# 메인 실행 함수
main() {
    echo "🚀 HealthWatch Pro 프로젝트 설정 시작"
    echo "====================================="
    
    check_requirements
    create_project_structure
    setup_environment
    setup_typescript
    setup_git
    setup_dev_tools
    create_db_init_script
    
    if validate_docker; then
        echo ""
        echo "✅ 프로젝트 설정이 완료되었습니다!"
        echo ""
        echo "다음 단계:"
        echo "1. backend/.env 파일을 열어서 환경 변수를 수정하세요"
        echo "2. Docker로 실행: docker-compose up -d"
        echo "3. 데이터베이스 초기화: ./scripts/init-db.sh"
        echo "4. 애플리케이션 접속:"
        echo "   - Frontend: http://localhost:3000"
        echo "   - Backend API: http://localhost:5000"
        echo "   - GraphQL Playground: http://localhost:5000/graphql"
        echo ""
        echo "개발 모드로 실행하려면:"
        echo "- Backend: cd backend && npm run dev"
        echo "- Frontend: cd frontend && npm start"
        echo ""
        print_success "Happy coding! 🎉"
    else
        print_error "설정 과정에서 오류가 발생했습니다."
        exit 1
    fi
}

# 도움말
show_help() {
    echo "HealthWatch Pro 프로젝트 설정 스크립트"
    echo ""
    echo "사용법: ./setup.sh [옵션]"
    echo ""
    echo "옵션:"
    echo "  -h, --help     이 도움말 표시"
    echo "  --dev-only     개발 환경만 설정 (Docker 건너뛰기)"
    echo "  --docker-only  Docker 환경만 설정"
    echo ""
}

# 명령행 인수 처리
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    --dev-only)
        echo "개발 환경만 설정합니다..."
        check_requirements
        create_project_structure
        setup_environment
        setup_typescript
        setup_git
        setup_dev_tools
        install_dependencies
        print_success "개발 환경 설정 완료!"
        ;;
    --docker-only)
        echo "Docker 환경만 설정합니다..."
        validate_docker
        create_db_init_script
        print_success "Docker 환경 설정 완료!"
        ;;
    *)
        main
        ;;
esac