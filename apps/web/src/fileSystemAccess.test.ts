import { describe, expect, it } from "vitest";
import { getDefaultRoleCatalog } from "./roleCatalog";
import { saveRoleCatalogToDirectory } from "./fileSystemAccess";

type MemoryDirectory = {
  kind: "directory";
  name: string;
  queryPermission: () => Promise<"granted">;
  requestPermission: () => Promise<"granted">;
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<MemoryDirectory>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<MemoryFileHandle>;
  readFileText: (name: string) => string | undefined;
};

type MemoryFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (data: string | Blob | BufferSource) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

function createMemoryDirectory(name: string): MemoryDirectory {
  const directories = new Map<string, MemoryDirectory>();
  const files = new Map<string, string>();

  const directory: MemoryDirectory = {
    kind: "directory",
    name,
    queryPermission: async () => "granted",
    requestPermission: async () => "granted",
    readFileText(fileName) {
      return files.get(fileName);
    },
    async getDirectoryHandle(nextName, options) {
      const existingDirectory = directories.get(nextName);
      if (existingDirectory) {
        return existingDirectory;
      }

      if (!options?.create) {
        throw new Error(`Missing directory: ${nextName}`);
      }

      const nextDirectory = createMemoryDirectory(nextName);
      directories.set(nextName, nextDirectory);
      return nextDirectory;
    },
    async getFileHandle(fileName, options) {
      if (!files.has(fileName) && !options?.create) {
        throw new Error(`Missing file: ${fileName}`);
      }

      if (!files.has(fileName)) {
        files.set(fileName, "");
      }

      return {
        kind: "file",
        name: fileName,
        async getFile() {
          return new File([files.get(fileName) ?? ""], fileName, {
            type: "application/json"
          });
        },
        async createWritable() {
          let nextContent = files.get(fileName) ?? "";

          return {
            async write(data) {
              if (typeof data === "string") {
                nextContent = data;
                return;
              }

              if (data instanceof Blob) {
                nextContent = await data.text();
                return;
              }

              nextContent = ArrayBuffer.isView(data)
                ? new TextDecoder().decode(data)
                : String(data);
            },
            async close() {
              files.set(fileName, nextContent);
            }
          };
        }
      };
    }
  };

  return directory;
}

describe("fileSystemAccess role catalog support", () => {
  it("saves and reloads the role catalog from a repo-local content folder", async () => {
    const rootDirectory = createMemoryDirectory("workspace-root");
    await rootDirectory.getDirectoryHandle("content", { create: true });
    const roleCatalog = getDefaultRoleCatalog().slice(0, 2);

    const saveResult = await saveRoleCatalogToDirectory(rootDirectory, roleCatalog);
    const contentDirectory = await rootDirectory.getDirectoryHandle("content");
    const rolesDirectory = await contentDirectory.getDirectoryHandle("roles");
    const savedJson = JSON.parse(
      rolesDirectory.readFileText("role-catalog.local.json") ?? "{}"
    ) as {
      roles?: { name: string }[];
    };

    expect(saveResult.displayPath).toBe("content/roles/role-catalog.local.json");
    expect(savedJson.roles?.map((role) => role.name)).toEqual(
      roleCatalog.map((role) => role.name)
    );
  });
});
