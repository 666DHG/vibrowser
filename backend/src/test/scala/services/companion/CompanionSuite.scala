package services.companion
import munit.CatsEffectSuite
import cats.effect.{IO, Resource, Deferred}
import cats.syntax.all.*
import scala.concurrent.duration.*
import org.http4s.{Response, Status}
import org.http4s.client.Client
import services.system.{DatabaseSession, SchemaInitializer, SqlExecutor}
import services.settings.api.{SaveSettingsMessage, GetSettingsMessage}
import services.browser.objects.BrowsingMode
import services.companion.api.*
import services.companion.objects.*
import services.companion.tables.CompanionTaskTable.CompanionTaskTable
import services.companion.utils.{CompanionRules, CompanionWorker}
class CompanionSuite extends CatsEffectSuite:
  private val context =
    CompanionContext(CompanionEvent.Click, "月球", "月球咖啡", BrowsingMode.Imagination)
  private def isolated[A](test: DatabaseSession => IO[A]): IO[A] =
    DatabaseSession
      .resource(
        s"jdbc:postgresql://127.0.0.1:${sys.env.getOrElse("VIBROWSER_DB_PORT", "55432")}/vibrowser?currentSchema=companion_test",
        "vibrowser",
        ""
      )
      .use { db =>
        db.transaction(c =>
          SqlExecutor.update(c, "CREATE SCHEMA IF NOT EXISTS companion_test") *> SchemaInitializer
            .initialize(c) *> CompanionTaskTable.clear(c)
        ) *> test(db)
      }
  private def awaitReply(
      db: DatabaseSession,
      id: String,
      remaining: Int = 100
  ): IO[CompanionReply] =
    db.transaction(GetCompanionReplyMessage(id).plan).flatMap { r =>
      if Set(CompanionStatus.Complete, CompanionStatus.Failed)(r.status) || remaining == 0 then
        IO.pure(r)
      else IO.sleep(100.millis) *> awaitReply(db, id, remaining - 1)
    }
  test("context and output are bounded; enums reject unknown values") {
    assert(CompanionRules.valid(context))
    assert(!CompanionRules.valid(context.copy(input = "x" * 201)))
    assertEquals(CompanionRules.reply(" "), None)
    assertEquals(CompanionRules.reply("字" * 41), None)
    assertEquals(CompanionRules.reply("<b>喵</b>"), None)
    assertEquals(CompanionRules.reply(" 喵。 "), Some("喵。"))
    assert(io.circe.parser.decode[CompanionEvent]("\"unknown\"").isLeft)
  }
  test("bounded concurrent queue, expired records and restart cleanup") {
    isolated { db =>
      for
        results <- (1 to 12).toList.parTraverse(i =>
          db.transaction(c => CompanionTaskTable.enqueue(c, CompanionTask(i.toString, context, 1)))
            .attempt
        )
        _ = assertEquals(results.count(_.isRight), 8)
        first <- db.transaction(CompanionTaskTable.claim)
        _ = assert(first.nonEmpty)
        _ <- db.transaction(c => CompanionTaskTable.finish(c, first.get.id, Some("喵")))
        reply <- db.transaction(GetCompanionReplyMessage(first.get.id).plan)
        _ = assertEquals(reply.status, CompanionStatus.Complete)
        _ <- db.transaction(c =>
          SqlExecutor.update(
            c,
            "UPDATE companion_tasks SET created_at=now()-interval '3 minutes'"
          ) *> CompanionTaskTable.cleanup(c)
        )
        expired <- db.transaction(GetCompanionReplyMessage(first.get.id).plan).attempt
        _ = assert(expired.isLeft)
        _ <- db.transaction(c =>
          CompanionTaskTable.enqueue(c, CompanionTask("restart", context, 1))
        )
        client = Client.fromHttpApp[IO](
          org.http4s.HttpApp[IO](_ => IO.pure(Response[IO](Status.Ok)))
        )
        _ <- CompanionModule.resource(db, client, true).use(_ => IO.unit)
        cleared <- db.transaction(c => CompanionTaskTable.get(c, "restart"))
        _ = assertEquals(cleared, None)
      yield ()
    }
  }
  test("worker holds no connection while awaiting provider; late timeout fails without retry") {
    isolated { db =>
      for
        config <- db.transaction(
          SaveSettingsMessage(
            "https://api.deepseek.com",
            "test",
            Some("test-only-not-a-real-key")
          ).plan
        )
        entered <- Deferred[IO, Unit]
        calls <- cats.effect.Ref.of[IO, Int](0)
        client = Client[IO](_ =>
          Resource.eval(calls.update(_ + 1) *> entered.complete(()).void *> IO.never[Response[IO]])
        )
        _ <- db.transaction(c =>
          CompanionTaskTable.enqueue(c, CompanionTask("timeout", context, config.revision))
        )
        _ <- Resource.make(new CompanionWorker(db, client, false).run.start)(_.cancel).use { _ =>
          for
            _ <- entered.get.timeout(3.seconds)
            acquired <- cats.effect.Ref.of[IO, Int](0)
            all <- Deferred[IO, Unit]
            _ <- List
              .fill(4)(
                db.transaction(_ =>
                  acquired
                    .updateAndGet(_ + 1)
                    .flatMap(n => (if n == 4 then all.complete(()).void else IO.unit) *> all.get)
                )
              )
              .parSequence
              .timeout(2.seconds)
            reply <- awaitReply(db, "timeout")
            _ = assertEquals(reply.status, CompanionStatus.Failed)
            count <- calls.get
            _ = assertEquals(count, 1)
          yield ()
        }
      yield ()
    }
  }
  test("mock worker completes and real worker rejects oversized provider replies") {
    isolated { db =>
      for
        config <- db.transaction(GetSettingsMessage().plan)
        _ <- db.transaction(c =>
          CompanionTaskTable.enqueue(c, CompanionTask("mock", context, config.revision))
        )
        client = Client.fromHttpApp[IO](
          org.http4s.HttpApp[IO](_ => IO.pure(Response[IO](Status.Ok).withEntity("x" * 20000)))
        )
        _ <- Resource
          .make(new CompanionWorker(db, client, true).run.start)(_.cancel)
          .use(_ =>
            awaitReply(db, "mock").map(r => assertEquals(r.status, CompanionStatus.Complete))
          )
        _ <- db.transaction(c =>
          CompanionTaskTable.enqueue(c, CompanionTask("large", context, config.revision))
        )
        _ <- Resource
          .make(new CompanionWorker(db, client, false).run.start)(_.cancel)
          .use(_ =>
            awaitReply(db, "large").map(r => assertEquals(r.status, CompanionStatus.Failed))
          )
      yield ()
    }
  }
