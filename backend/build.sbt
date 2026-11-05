ThisBuild / scalaVersion := "3.3.7"
ThisBuild / organization := "edu.vibrowser"
ThisBuild / version := "0.1.0"
lazy val writeRuntimeClasspath = taskKey[File]("Write the local runtime classpath for Windows launch scripts")
lazy val root = (project in file(".")).settings(
  name := "vibrowser",
  libraryDependencies ++= Seq(
    "org.typelevel" %% "cats-effect" % "3.6.3",
    "org.http4s" %% "http4s-dsl" % "0.23.30",
    "org.http4s" %% "http4s-ember-server" % "0.23.30",
    "org.http4s" %% "http4s-ember-client" % "0.23.30",
    "org.http4s" %% "http4s-circe" % "0.23.30",
    "io.circe" %% "circe-generic" % "0.14.10",
    "io.circe" %% "circe-parser" % "0.14.10",
    "com.zaxxer" % "HikariCP" % "6.3.0",
    "org.postgresql" % "postgresql" % "42.7.5",
    "net.java.dev.jna" % "jna-platform" % "5.17.0",
    "org.jsoup" % "jsoup" % "1.18.3",
    "com.helger" % "ph-css" % "7.0.4",
    "org.slf4j" % "slf4j-simple" % "2.0.17",
    "org.typelevel" %% "munit-cats-effect" % "2.1.0" % Test
  ),
  scalacOptions ++= Seq("-deprecation", "-feature", "-unchecked"),
  Test / parallelExecution := false,
  Test / fork := true,
  Test / javaOptions ++= Seq("-XX:ActiveProcessorCount=4", "-Djava.net.preferIPv4Stack=true"),
  Compile / run / fork := true,
  Compile / run / mainClass := Some("services.system.Main"),
  writeRuntimeClasspath := {
    val output = baseDirectory.value.getParentFile / ".cache" / "runtime-classpath.txt"
    IO.write(output, (Runtime / fullClasspath).value.files.map(_.getAbsolutePath).mkString(java.io.File.pathSeparator))
    output
  }
)
