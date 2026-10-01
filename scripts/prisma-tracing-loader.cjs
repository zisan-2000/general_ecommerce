// Keep Prisma's runtime path discovery, but avoid tracing the entire project.
// Applied to generated sources during bundling so prisma generate cannot undo it.
module.exports = function prismaTracingLoader(source) {
  return source
    .replace(
      /path\.join\(process\.cwd\(\), (altPath|alternativePath)([,\)])/g,
      'path.join(/* turbopackIgnore: true */ process.cwd(), $1$2',
    )
    .replace(
      /(\.resolve\(process\.cwd\(\),["']\.env\.vault["']\);return\s+[\w$]+\.existsSync\()([\w$]+)(\))/g,
      '$1/* turbopackIgnore: true */ $2$3',
    );
};
