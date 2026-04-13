const SUPPORTED_CODE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "css",
  "html",
  "md",
  "py",
  "java",
  "go",
  "rs",
  "c",
  "cpp",
  "h",
  "hpp",
  "sh",
]);

const MAX_FILES = 20;
const MAX_FILE_SIZE = 25_000;

interface GitHubTreeResponse {
  tree?: Array<{
    path: string;
    type: "blob" | "tree";
  }>;
}

const parseGitHubRepo = (gitUrl: string) => {
  try {
    const parsedUrl = new URL(gitUrl);
    if (!parsedUrl.hostname.includes("github.com")) {
      return null;
    }

    const [owner, repo] = parsedUrl.pathname.split("/").filter(Boolean);
    if (!owner || !repo) {
      return null;
    }

    return {
      owner,
      repo: repo.replace(/\.git$/, ""),
    };
  } catch {
    return null;
  }
};

const fetchGitHubDefaultBranch = async (owner: string, repo: string) => {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (!response.ok) {
    throw new Error("Unable to load repository metadata from GitHub.");
  }

  const data = (await response.json()) as { default_branch?: string };
  return data.default_branch || "main";
};

const isSupportedCodeFile = (path: string) => {
  const extension = path.split(".").pop()?.toLowerCase();
  return Boolean(extension && SUPPORTED_CODE_EXTENSIONS.has(extension));
};

export function extractGitUrl(submissionText: string): string | null {
  if (!submissionText) return null;

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = submissionText.match(urlRegex) || [];

  for (const url of urls) {
    const lowerUrl = url.toLowerCase();
    if (
      lowerUrl.includes("github.com") ||
      lowerUrl.includes("gitlab.com") ||
      lowerUrl.includes("bitbucket.org")
    ) {
      return url;
    }
  }

  return null;
}

export async function fetchRepositoryCode(gitUrl: string): Promise<string> {
  try {
    const githubRepo = parseGitHubRepo(gitUrl);
    if (!githubRepo) {
      return `Code access may be limited. Evaluate based on the following Git URL: ${gitUrl}`;
    }

    const branch = await fetchGitHubDefaultBranch(
      githubRepo.owner,
      githubRepo.repo,
    );
    const treeResponse = await fetch(
      `https://api.github.com/repos/${githubRepo.owner}/${githubRepo.repo}/git/trees/${branch}?recursive=1`,
    );

    if (!treeResponse.ok) {
      throw new Error("Unable to load repository tree from GitHub.");
    }

    const treeData = (await treeResponse.json()) as GitHubTreeResponse;
    const codeFiles = (treeData.tree ?? [])
      .filter((entry) => entry.type === "blob" && isSupportedCodeFile(entry.path))
      .slice(0, MAX_FILES);

    if (codeFiles.length === 0) {
      return `No supported source files were found. Evaluate based on the repository URL: ${gitUrl}`;
    }

    const fetchedFiles = await Promise.all(
      codeFiles.map(async (file) => {
        const rawUrl = `https://raw.githubusercontent.com/${githubRepo.owner}/${githubRepo.repo}/${branch}/${file.path}`;
        const response = await fetch(rawUrl);
        if (!response.ok) {
          return null;
        }

        const content = (await response.text()).slice(0, MAX_FILE_SIZE);
        return `FILE: ${file.path}\n${content}`;
      }),
    );

    const combinedCode = fetchedFiles.filter(Boolean).join("\n\n");
    return combinedCode || `Code access may be limited. Evaluate based on the following Git URL: ${gitUrl}`;
  } catch {
    return `Code access may be limited. Evaluate based on the following Git URL: ${gitUrl}`;
  }
}
