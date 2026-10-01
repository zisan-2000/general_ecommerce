// Keep Prisma's runtime path discovery, but avoid tracing the entire project.
// Applied to generated sources during bundling so prisma generate cannot undo it.
module.exports = function prismaTracingLoader(source) {
  return source
    .replace(
      /path\.join\(process\.cwd\(\),\s*(altPath|alternativePath)([,\)])/g,
      'path.join(/* turbopackIgnore: true */ process.cwd(), $1$2',
    )
    // The ignored join is deliberately unknown to the tracer. Ignore the
    // enclosing existence check as well so it cannot trace that unknown path.
    .replace(
      /fs\.existsSync\((path\.join\(\/\* turbopackIgnore: true \*\/ process\.cwd\(\),\s*altPath,)/g,
      'fs.existsSync(/* turbopackIgnore: true */ $1',
    )
    .replace(
      /(\.resolve\(process\.cwd\(\),\s*["']\.env\.vault["']\);\s*return\s+[\w$]+\.existsSync\()([\w$]+)(\))/g,
      '$1/* turbopackIgnore: true */ $2$3',
    );
};
