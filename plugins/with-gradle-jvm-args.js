const { withGradleProperties } = require("expo/config-plugins");

/**
 * Give the Gradle daemon more memory than the generated gradle.properties
 * default (-Xmx2048m -XX:MaxMetaspaceSize=512m). With that default, release
 * builds run out of Metaspace in expo-updates' KSP task.
 */
const JVM_ARGS = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";

module.exports = function withGradleJvmArgs(config) {
  return withGradleProperties(config, (config) => {
    const properties = config.modResults.filter(
      (item) => !(item.type === "property" && item.key === "org.gradle.jvmargs"),
    );
    properties.push({
      type: "property",
      key: "org.gradle.jvmargs",
      value: JVM_ARGS,
    });
    config.modResults = properties;
    return config;
  });
};
