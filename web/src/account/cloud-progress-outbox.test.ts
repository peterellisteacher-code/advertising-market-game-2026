import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createBlankCampaignDocument, type CampaignDocumentV1 } from "../domain/campaign-document";
import { BrowserCloudProgressOutbox } from "./cloud-progress-outbox";

function documentFixture(name: string, revision = 0): CampaignDocumentV1 {
  const document = createBlankCampaignDocument({
    documentId: "campaign-main",
    sessionId: "practice-session",
    teamId: "practice-team",
    mode: "offline"
  });
  document.product.name = name;
  document.revision = revision;
  return document;
}

describe("BrowserCloudProgressOutbox", () => {
  it("keeps pending documents isolated by the hashed account namespace", async () => {
    const factory = new IDBFactory();
    const outbox = new BrowserCloudProgressOutbox({
      factory,
      databasePrefix: "test-cloud-outbox-isolation-"
    });
    await outbox.activateAccount("team-one");
    await outbox.put(documentFixture("Team one bottle"));
    outbox.deactivateAccount();

    await outbox.activateAccount("team-two");
    await expect(outbox.list()).resolves.toEqual([]);
    await outbox.put(documentFixture("Team two lamp"));
    outbox.deactivateAccount();

    await outbox.activateAccount("team-one");
    await expect(outbox.list()).resolves.toMatchObject([
      { document: { product: { name: "Team one bottle" } } }
    ]);
  });

  it("coalesces each document ID to the newest complete snapshot", async () => {
    const outbox = new BrowserCloudProgressOutbox({
      factory: new IDBFactory(),
      databasePrefix: "test-cloud-outbox-coalesce-"
    });
    await outbox.activateAccount("team-one");

    const first = await outbox.put(documentFixture("First"));
    const second = await outbox.put(documentFixture("Latest"));

    expect(second.queueRevision).toBeGreaterThan(first.queueRevision);
    await expect(outbox.list()).resolves.toMatchObject([{
      documentId: "campaign-main",
      queueRevision: second.queueRevision,
      document: { product: { name: "Latest" } }
    }]);
  });

  it("survives a new runtime instance and removes only the acknowledged queue revision", async () => {
    const factory = new IDBFactory();
    const options = {
      factory,
      databasePrefix: "test-cloud-outbox-reload-"
    };
    const firstRuntime = new BrowserCloudProgressOutbox(options);
    await firstRuntime.activateAccount("team-one");
    const first = await firstRuntime.put(documentFixture("First"));
    const newest = await firstRuntime.put(documentFixture("Latest", 1));
    firstRuntime.deactivateAccount();

    const reloaded = new BrowserCloudProgressOutbox(options);
    await reloaded.activateAccount("team-one");
    await expect(reloaded.get("campaign-main")).resolves.toMatchObject({
      queueRevision: newest.queueRevision,
      document: { product: { name: "Latest" }, revision: 1 }
    });

    await expect(reloaded.removeIfRevision("campaign-main", first.queueRevision))
      .resolves.toBe(false);
    await expect(reloaded.get("campaign-main")).resolves.not.toBeNull();
    await expect(reloaded.removeIfRevision("campaign-main", newest.queueRevision))
      .resolves.toBe(true);
    await expect(reloaded.get("campaign-main")).resolves.toBeNull();
  });
});
