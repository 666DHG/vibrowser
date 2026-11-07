package services.system
import cats.effect.IO
import cats.syntax.all.*
import java.sql.Connection
import services.browser.tables.PageTable.PageTableInitializer
import services.browser.tables.BookmarkTable.BookmarkTableInitializer
import services.generation.tables.GenerationJobTable.{
  GenerationJobTable,
  GenerationJobTableInitializer
}
import services.settings.tables.SettingsTable.SettingsTableInitializer
import services.settings.tables.CredentialsTable.CredentialsTableInitializer
import services.generation.api.FailGenerationJobMessage
object SchemaInitializer:
  def initialize(c: Connection): IO[Unit] =
    PageTableInitializer.initialize(
      c
    ) *> services.browser.tables.ResearchSnapshotTable.ResearchSnapshotTableInitializer
      .initialize(c) *> GenerationJobTableInitializer.initialize(c) *>
      SettingsTableInitializer.initialize(
        c
      ) *> services.settings.tables.ResearchSettingsTable.ResearchSettingsTableInitializer
        .initialize(c) *> CredentialsTableInitializer.initialize(
        c
      ) *> BookmarkTableInitializer.initialize(
        c
      ) *> services.browser.tables.PageActionTable.PageActionTableInitializer.initialize(c) *>
      services.companion.tables.CompanionTaskTable.CompanionTaskTableInitializer.initialize(c)
  def recover(c: Connection): IO[Unit] =
    GenerationJobTable
      .interrupted(c)
      .flatMap(_.traverse_(j => FailGenerationJobMessage(j.id, "服务已重启，上次任务中断，请重试").plan(c)))
