# Based on Sandcastle's claude-code template (sandcastle init --agent claude-code).
FROM node:22-bookworm

RUN apt-get update && apt-get install -y git curl jq ripgrep \
  && rm -rf /var/lib/apt/lists/*

# Sandcastle builds with the host UID/GID so bind-mounted worktree files keep their owner.
ARG AGENT_UID=1000
ARG AGENT_GID=1000
RUN groupmod -o -g $AGENT_GID node && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent node
USER ${AGENT_UID}:${AGENT_GID}

RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/home/agent/.local/bin:$PATH"

# Mack mounts the matt-pocock-engineering skill pack read-only at /home/agent/.claude/skills.
WORKDIR /home/agent
ENTRYPOINT ["sleep", "infinity"]
