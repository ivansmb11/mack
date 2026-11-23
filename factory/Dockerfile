# Based on Sandcastle's claude-code template (sandcastle init --agent claude-code).
FROM node:22-bookworm

# gh reads tickets; Mack passes FACTORY_GH_TOKEN in as GH_TOKEN. https://github.com/cli/cli/blob/trunk/docs/install_linux.md
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y git curl jq ripgrep gh \
  && rm -rf /var/lib/apt/lists/*

# Sandcastle builds with the host UID/GID so bind-mounted worktree files keep their owner.
ARG AGENT_UID=1000
ARG AGENT_GID=1000
RUN groupmod -o -g $AGENT_GID node && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent node
USER ${AGENT_UID}:${AGENT_GID}

RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/home/agent/.local/bin:$PATH"

# Mack mounts every skill of factory.skillPacks read-only under /home/agent/.claude/skills.
WORKDIR /home/agent
ENTRYPOINT ["sleep", "infinity"]
