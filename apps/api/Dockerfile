# 백엔드 이미지. 배포에서만 쓴다. 로컬 개발은 `./gradlew bootRun` 이다. (#19)
#
#   docker build -t ieobom-api apps/api
#
# 빌드는 JDK, 실행은 JRE 로 나눈다. 최종 이미지에 Gradle 과 소스가 남지 않는다.

FROM eclipse-temurin:21-jdk AS build
WORKDIR /build

# 의존성 목록만 먼저 넣어 레이어를 캐시한다.
# 소스만 바뀐 빌드에서 의존성을 다시 받지 않게 하려는 것이다.
COPY gradle/ gradle/
COPY gradlew build.gradle settings.gradle ./
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies

COPY src/ src/
# 테스트는 CI(`api.yml`)가 이미 돌린다. 이미지 빌드에서 또 돌리면 배포가 그만큼 늦어진다.
RUN ./gradlew --no-daemon bootJar -x test

FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# root 로 돌리지 않는다.
RUN addgroup -S ieobom && adduser -S -G ieobom ieobom

COPY --from=build /build/build/libs/*.jar app.jar
RUN chown -R ieobom:ieobom /app
USER ieobom

# 시각은 컨테이너에서도 한국 기준이다. 기한이 당일 HH:MM 이라 여기가 어긋나면 업무 기한이 어긋난다.
ENV TZ=Asia/Seoul

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
