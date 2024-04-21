export default {
  logo: <span style={{ fontWeight: 600 }}>release-it-pnpm</span>,
  useNextSeoProps() {
    return {
      titleTemplate: "%s – release-it-pnpm",
    };
  },
  project: {
    link: "https://github.com/hyoban/release-it-pnpm",
  },
  docsRepositoryBase:
    "https://github.com/hyoban/release-it-pnpm/tree/main/docs",
};
