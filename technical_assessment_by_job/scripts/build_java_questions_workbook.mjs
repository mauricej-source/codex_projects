import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const baseDataPath = path.join(projectRoot, "java_question_titles.json");
const outputDir = path.join(projectRoot, "outputs");
const outputPath = path.join(outputDir, "java_questions.xlsx");

const baseSource = {
  label: "InterviewBit Java Interview Questions",
  url: "https://www.interviewbit.com/java-interview-questions/",
};

const additionalSources = [
  {
    label: "InterviewBit Java 8 Interview Questions",
    url: "https://www.interviewbit.com/java-8-interview-questions/",
    htmlPath: path.join(projectRoot, "tmp_java-8-interview-questions.html"),
    ignoredHeadings: new Set(["Learn via our Video Courses", "Resources"]),
  },
  {
    label: "InterviewBit Java Collections Interview Questions",
    url: "https://www.interviewbit.com/java-collections-interview-questions/",
    htmlPath: path.join(projectRoot, "tmp_java-collections-interview-questions.html"),
    ignoredHeadings: new Set(),
  },
  {
    label: "InterviewBit Java Interview Questions for 5 Years Experience",
    url: "https://www.interviewbit.com/java-interview-questions-for-5-years-experience/",
    htmlPath: path.join(projectRoot, "tmp_java-interview-questions-for-5-years-experience.html"),
    ignoredHeadings: new Set(["Resources"]),
  },
  {
    label: "InterviewBit Advance Java MCQ",
    url: "https://www.interviewbit.com/advance-java-mcq/",
    htmlPath: path.join(projectRoot, "tmp_advance-java-mcq.html"),
    ignoredHeadings: new Set(["Resources"]),
  },
  {
    label: "InterviewBit Java String Interview Questions",
    url: "https://www.interviewbit.com/java-string-interview-questions/",
    htmlPath: path.join(projectRoot, "tmp_java-string-interview-questions.html"),
    ignoredHeadings: new Set(),
  },
  {
    label: "InterviewBit Java Programming Interview Questions",
    url: "https://www.interviewbit.com/java-programming-interview-questions/",
    htmlPath: path.join(projectRoot, "tmp_java-programming-interview-questions.html"),
    ignoredHeadings: new Set(["Learn via our Video Courses", "Additional Resources"]),
  },
  {
    label: "InterviewBit Java Array Interview Questions",
    url: "https://www.interviewbit.com/java-array-interview-questions/",
    htmlPath: path.join(projectRoot, "tmp_java-array-interview-questions.html"),
    ignoredHeadings: new Set(["Learn via our Video Courses"]),
  },
];

const decodeHtml = (text) =>
  text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\s+/g, " ")
    .trim();

const cleanQuestion = (question) =>
  question
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

const isUsableQuestion = (question) =>
  Boolean(question) &&
  !/^\s*(conclusion|interview preparation resources)\s*$/i.test(question);

const extractQuestionsFromHtml = async (source) => {
  const html = await fs.readFile(source.htmlPath, "utf8");
  const tagRegex = /<(h2|h3)[^>]*>(.*?)<\/\1>/gis;
  const extracted = [];
  let currentSection = "";
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const text = decodeHtml(match[2]);

    if (!text) {
      continue;
    }

    if (tag === "h2") {
      currentSection = source.ignoredHeadings.has(text) ? "" : text;
      continue;
    }

    if (!currentSection) {
      continue;
    }

    if (!/^\d+\./.test(text) || /download pdf/i.test(text)) {
      continue;
    }

    const question = cleanQuestion(text);
    if (!isUsableQuestion(question)) {
      continue;
    }

    extracted.push({
      section: currentSection,
      question,
      sourceLabel: source.label,
      sourceUrl: source.url,
    });
  }

  return extracted;
};

const exactAnswers = new Map([
  [
    "Check if a given string is palindrome using recursion.",
    "Use a recursive function with two pointers or a shrinking substring. Compare the first and last characters, return false on mismatch, and recurse inward until the base case of zero or one character returns true.",
  ],
  [
    "Write a Java Program to print Fibonacci Series using Recursion.",
    "Define a recursive method where F(0)=0 and F(1)=1, then compute F(n)=F(n-1)+F(n-2). For interview quality, mention that this is easy to explain but inefficient without memoization.",
  ],
  [
    "Write a Java program to check if the two strings are anagrams.",
    "Normalize the strings first by trimming case and spaces if required, then either sort both character arrays and compare them or count character frequencies in a map or array. If the normalized forms match, the strings are anagrams.",
  ],
  [
    "Write a Java Program to find the factorial of a given number.",
    "Factorial can be implemented iteratively or recursively. Multiply the integers from 1 to n, with 0! defined as 1, and mention overflow risk for large values unless BigInteger is used.",
  ],
  [
    "Write a Java program to reverse a string.",
    "You can reverse a string with StringBuilder.reverse() for a concise solution, or manually swap characters with two pointers for interview clarity. Mention that Strings are immutable, so the result is a new value.",
  ],
  [
    "Write a Java program to create and throw custom exceptions.",
    "Create a class that extends Exception or RuntimeException, add constructors for message and cause, then throw it with throw new CustomException(...). The caller either catches it or declares it with throws if it is checked.",
  ],
  [
    "Write a Java program for solving the Tower of Hanoi Problem.",
    "Use recursion: move n-1 disks from source to auxiliary, move the largest disk to destination, then move n-1 disks from auxiliary to destination. The base case is one disk, and the total moves are 2^n - 1.",
  ],
  [
    "Implement Binary Search in Java using recursion.",
    "Pass low and high indices to a recursive method, compute mid, compare the target with the middle element, and recurse only into the relevant half. Stop when low exceeds high or the target is found.",
  ],
]);

const buildAnswer = (question, section) => {
  if (exactAnswers.has(question)) {
    return exactAnswers.get(question);
  }

  const q = question.toLowerCase();
  const s = section.toLowerCase();

  if (q.includes("platform independent")) return "Java is platform independent because source code compiles to bytecode, and any system with a compatible JVM can run that bytecode without recompiling the program.";
  if (q.includes("object oriented")) return "Java strongly supports object-oriented programming through classes, inheritance, polymorphism, and encapsulation, but primitives and some static constructs keep it from being a completely pure object-oriented language.";
  if (q.includes("heap") && q.includes("stack")) return "Stack memory stores method frames and local variables per thread, while heap memory stores objects shared by the application. Java uses the stack for execution context and the heap for object allocation and garbage collection.";
  if (q.includes("c++")) return "Java focuses on portability, managed memory, and runtime safety, while C++ gives more direct low-level control over memory and system resources.";
  if (q.includes("pointer")) return "Java avoids raw pointers to reduce memory corruption and security risks. It uses object references instead of exposing pointer arithmetic.";
  if (q.includes("instance variable") && q.includes("local variable")) return "An instance variable belongs to an object and gets default initialization, while a local variable exists only inside a method or block and must be assigned before use.";
  if (q.includes("default values")) return "Instance fields receive defaults such as 0, false, and null. Local variables do not get default values and must be initialized explicitly.";
  if (q.includes("encapsulation")) return "Encapsulation means keeping data and related behavior inside a class and controlling access through visibility modifiers such as private, protected, and public.";
  if (q.includes("jit")) return "The JIT compiler translates frequently executed bytecode into native machine code at runtime so hot paths run faster.";
  if (q.includes("equals") || q.includes("==")) return "== compares identity for objects and direct values for primitives, while equals() is intended for logical content comparison when a class overrides it correctly.";
  if (q.includes("constructor")) return "Constructors initialize objects when they are created. Overloading lets you support multiple valid initialization paths, and constructor chaining with this() or super() keeps object setup consistent.";
  if (q.includes("overloading") || q.includes("overriding")) return "Overloading is compile-time polymorphism with different parameter lists, while overriding is runtime polymorphism where a subclass provides a new implementation of an inherited method.";
  if (q.includes("try") && q.includes("catch")) return "A try block can be followed by one or more catch blocks so different exception types are handled separately. Specific exceptions should be listed before broad ones.";
  if (q.includes("final")) return "final prevents reassignment on variables, prevents overriding on methods, and prevents inheritance on classes. finally is an exception-handling block, and finalize() is deprecated and should not be relied on.";
  if (q.includes("super")) return "super is used to call a parent constructor, invoke a parent implementation of an overridden method, or refer to a hidden parent field.";
  if (q.includes("static")) return "Static members belong to the class rather than any one instance. Static methods can be overloaded, but they are hidden rather than overridden.";
  if (q.includes("garbage collection") || q.includes("gc")) return "Garbage collection reclaims heap memory from unreachable objects so the application can continue allocating memory safely.";
  if (q.includes("classloader")) return "A ClassLoader loads compiled classes into the JVM on demand and typically follows parent delegation before loading application classes itself.";
  if (q.includes("shallow copy") || q.includes("deep copy")) return "A shallow copy duplicates the outer object but reuses referenced nested objects, while a deep copy duplicates referenced mutable state as well.";
  if (q.includes("string immutable") || q.includes("strings immutable")) return "String immutability improves safety, supports interning and caching, and makes strings reliable as map keys and in multithreaded code.";
  if (q.includes("singleton")) return "A singleton restricts a class to one shared instance. In Java, an enum singleton is often the safest and simplest implementation.";
  if (q.includes("stringbuffer") || q.includes("stringbuilder")) return "String is immutable, StringBuffer is mutable and synchronized, and StringBuilder is mutable but not synchronized. StringBuilder is usually preferred in single-threaded code.";
  if (q.includes("interface") && q.includes("abstract")) return "Interfaces define contracts and support multiple inheritance of type, while abstract classes can provide shared state and partial implementation.";
  if (q.includes("comparator") || q.includes("comparable")) return "Comparable defines a class's natural ordering, while Comparator provides an external ordering that can be swapped or customized independently of the class.";
  if (q.includes("thread")) return "A strong Java thread answer should cover thread lifecycle, synchronization, visibility, and coordination tools such as wait/notify, locks, or executors depending on the specific question.";
  if (q.includes("reflection")) return "Reflection lets code inspect classes, fields, methods, and annotations at runtime. It is powerful for frameworks and tooling, but should be used carefully for performance and clarity.";
  if (q.includes("pass by value") || q.includes("pass by reference")) return "Java is pass-by-value. For objects, the copied value is the reference, so methods can mutate the object but cannot replace the caller's reference.";
  if (q.includes("serialization")) return "Java serialization converts object state into a storable or transferable form. Fields can be excluded with transient, and version compatibility is typically managed with serialVersionUID.";
  if (q.includes("hashcode") || q.includes("hash map") || q.includes("hashmap") || q.includes("hashtable")) return "A good answer should explain hashing, equality consistency, null-handling differences, synchronization behavior, and why the hashCode()/equals() contract matters for correct bucket lookup.";
  if (q.includes("factory design pattern")) return "The Factory pattern centralizes object creation behind an abstraction so callers depend on a contract instead of concrete constructors.";
  if (q.includes("lambda")) return "A lambda expression is a compact way to represent behavior as data. In Java it is typically used to implement a functional interface with a single abstract method.";
  if (q.includes("functional interface") || q.includes("sam")) return "A functional interface has exactly one abstract method, which allows a lambda or method reference to target it cleanly.";
  if (q.includes("static methods in interfaces")) return "Static interface methods belong to the interface itself rather than implementations, so they are called with InterfaceName.methodName().";
  if (q.includes("default method")) return "A default method lets an interface ship a concrete implementation so new behavior can be added without breaking all existing implementers.";
  if (q.includes("metaspace") || q.includes("permgen")) return "PermGen was a fixed-size metadata area in older JVMs, while MetaSpace uses native memory and grows more flexibly based on configuration and pressure.";
  if (q.includes("optional")) return "Optional is a container that represents presence or absence of a value. It is useful for API clarity and avoiding some null-check boilerplate, but it should be used intentionally rather than everywhere.";
  if (q.includes("stream")) return "Streams model a pipeline over data with source, intermediate operations, and terminal operations. They focus on declarative processing rather than direct collection mutation.";
  if (q.includes("intermediate") || q.includes("terminal")) return "Intermediate stream operations transform or filter the pipeline lazily, while terminal operations trigger execution and produce a result or side effect.";
  if (q.includes("findfirst") || q.includes("findany")) return "findFirst() preserves encounter order when one exists, while findAny() allows more flexibility and can be more efficient in parallel pipelines.";
  if (q.includes("localdate") || q.includes("localtime") || q.includes("localdatetime") || q.includes("date and time")) return "The Java 8 date/time API is immutable, thread-safe, and clearer than the old Date/Calendar APIs. LocalDate, LocalTime, and LocalDateTime model date-only, time-only, and combined local timestamps.";
  if (q.includes("nashorn") || q.includes("jjs")) return "Nashorn was Java's embedded JavaScript engine, and jjs was its command-line shell. They were useful historically but later deprecated and removed from newer JDKs.";
  if (q.includes("volatile") || q.includes("transient")) return "volatile is about visibility across threads, while transient controls serialization by excluding a field from the default serialized form.";
  if (q.includes("vector") && q.includes("arraylist")) return "Vector is synchronized and legacy-oriented, while ArrayList is unsynchronized and usually preferred unless external synchronization is required.";
  if (q.includes("collection different from collections")) return "Collection is a root interface in the framework, while Collections is a utility class containing helper algorithms and wrappers.";
  if (q.includes("classpath") || q.includes("path variables")) return "PATH helps the operating system find executables, while CLASSPATH helps the JVM find compiled classes and resources.";
  if (q.includes("wait()")) return "wait() should usually be called inside a loop that re-checks the condition after wake-up, because spurious wakeups and racing threads can make a simple if-check unsafe.";
  if (q.includes("multi-threaded environment")) return "Standard HashMap is not thread-safe for concurrent mutation. Use synchronization or a concurrent implementation such as ConcurrentHashMap when multiple threads can update shared map state.";
  if (q.includes("hashset") && q.includes("treeset")) return "HashSet stores unique values with no ordering and fast average lookup, while TreeSet stores unique values in sorted order with logarithmic operations.";
  if (q.includes("collection framework")) return "A strong answer should cover the main interfaces such as List, Set, Queue, and Map, plus the tradeoffs between common implementations like ArrayList, LinkedList, HashSet, TreeSet, HashMap, and TreeMap.";
  if (q.includes("linkedlist") || q.includes("arraylist")) return "ArrayList is usually better for indexed access and append-heavy workloads, while LinkedList is specialized for node-based insertion/removal patterns but has poor cache locality and random access.";
  if (q.includes("iterator") || q.includes("listiterator") || q.includes("enumeration")) return "Iterator is the modern traversal API, ListIterator adds bidirectional movement and indexed list operations, and Enumeration is the older legacy style.";
  if (q.includes("priority queue")) return "PriorityQueue stores elements according to priority rather than insertion order and is commonly implemented as a heap with efficient access to the highest- or lowest-priority element.";
  if (q.includes("set and map")) return "Set stores unique elements, while Map stores key-value associations. Map is conceptually separate because it models pairs rather than direct element membership.";
  if (q.includes("load factor")) return "Load factor controls how full a hash-based structure becomes before resizing. Lower values use more memory but can reduce collision costs.";
  if (q.includes("read-only")) return "A read-only collection view can be created with utility wrappers such as Collections.unmodifiableList(...), which prevents mutation through that reference.";
  if (q.includes("blockingqueue")) return "BlockingQueue supports producer-consumer coordination by allowing put/take style operations that can wait when the queue is full or empty.";
  if (q.includes("fail-fast") || q.includes("fail-safe")) return "Fail-fast iterators detect structural modification and throw ConcurrentModificationException on a best-effort basis, while fail-safe style iteration works over a snapshot or concurrent structure and tolerates mutation differently.";
  if (q.includes("randomaccess")) return "RandomAccess is a marker interface used to signal that indexed access is efficient, as with ArrayList.";
  if (q.includes("properties class") || q.includes("properties file")) return "Properties is a key-value configuration mechanism commonly used for simple externalized settings that can be loaded from files or streams.";
  if (q.includes("treemap")) return "TreeMap keeps keys sorted and typically offers O(log n) operations, while HashMap is unordered and optimized for average O(1) lookup.";
  if (q.includes("synchronize an arraylist")) return "ArrayList can be synchronized externally with synchronized blocks or wrapped using Collections.synchronizedList(...).";
  if (q.includes("string pool") || q.includes("intern()")) return "The string pool lets identical literals and interned strings share storage. intern() returns the pooled representative for a string value.";
  if (q.includes("substring")) return "substring() returns a new string representing a selected range of characters from the original string based on start and optional end indices.";
  if (q.includes("switch case")) return "Java allows strings in switch statements, which improves readability when branching on a known set of text values.";
  if (q.includes("subsequence")) return "subSequence() returns a CharSequence view-like result over a specified range and is similar in spirit to substring().";
  if (q.includes("stringjoiner")) return "StringJoiner helps build delimited text safely and clearly, especially when prefixes or suffixes are needed around the joined output.";
  if (q.includes("byte array")) return "A string can be converted to bytes with getBytes(Charset), and the chosen charset matters because encoding controls how characters become bytes.";
  if (q.includes("integer and vice versa")) return "String-to-int conversion commonly uses Integer.parseInt(), while int-to-string conversion commonly uses String.valueOf() or Integer.toString().";
  if (q.includes("string to stringbuilder")) return "A StringBuilder can be created directly from a String with new StringBuilder(existingString).";
  if (q.includes("empty in java")) return "String emptiness is usually checked with isEmpty() after a null check, and blankness can be checked with isBlank() in newer Java versions.";
  if (q.includes("char array") && q.includes("password")) return "char[] is safer for secrets because you can overwrite the contents after use, whereas String is immutable and may remain in memory longer.";
  if (q.includes("string methods")) return "A strong answer should mention commonly used methods like length(), charAt(), substring(), equals(), compareTo(), indexOf(), split(), replace(), trim()/strip(), and case conversions.";
  if (q.includes("thread-safe in java")) return "String is effectively thread-safe because it is immutable; no thread can mutate the characters after construction.";
  if (q.includes("hashmap key")) return "String is a strong HashMap key choice because it is immutable, has a stable hash code, and defines content-based equality.";
  if (q.includes("split a string")) return "split() uses a regular expression delimiter, so simple delimiters are easy but regex escaping matters for special characters.";
  if (q.includes("permutations of string")) return "A common solution uses recursion with swapping or prefix-building, generating all possible arrangements and handling duplicates if necessary.";
  if (q.includes("jagged array")) return "A jagged array is an array of arrays where each row can have a different length, which is useful when row sizes vary naturally.";
  if (q.includes("2d array")) return "A 2D array in Java is an array of arrays, so it can represent a rectangular matrix or a jagged structure depending on initialization.";
  if (q.includes("row-wise") || q.includes("column-wise sums")) return "Row and column sums are typically computed by nested iteration, updating per-row and per-column accumulators as each cell is visited.";
  if (q.includes("transpose a matrix")) return "Transposing a matrix swaps rows and columns. In-place transposition is straightforward only for square matrices; rectangular matrices usually require new storage.";
  if (q.includes("primitive arrays") || q.includes("autoboxing")) return "Primitive arrays avoid boxing overhead and usually use less memory than ArrayList<Integer>, which stores object references and boxed values.";
  if (q.includes("two-pointer")) return "Two-pointer techniques are effective when order matters or when a sorted structure lets you move boundaries deterministically rather than using extra hashing space.";
  if (q.includes("duplicates removed")) return "Removing duplicates from a sorted array in-place usually uses a slow/fast pointer technique that compacts unique values toward the front.";
  if (q.includes("all zeros moved")) return "Moving zeros while preserving order typically uses a write pointer to place non-zero values first and then fills the remaining slots with zeros.";
  if (q.includes("maximum sum subarray of size k")) return "This is a classic sliding-window problem: maintain the sum of the current window and update it in O(1) as the window moves.";
  if (q.includes("prefix sums") || q.includes("range sum")) return "Prefix sums precompute cumulative totals so later range-sum queries can be answered quickly by subtraction.";
  if (q.includes("kadane")) return "Kadane's Algorithm works by deciding at each position whether to extend the current subarray or start fresh there, which yields an O(n) maximum subarray solution.";
  if (q.includes("length and a string")) return "Arrays expose a length field, while String exposes a length() method because String is a class with behavior rather than a built-in array type.";
  if (q.includes("arr[arr.length]") || q.includes("exception")) return "Valid array indices go from 0 to length-1, so accessing arr[arr.length] throws ArrayIndexOutOfBoundsException.";
  if (q.includes("passed to methods")) return "Java passes array references by value, so the called method receives a copy of the reference and can mutate the same underlying array contents.";
  if (q.includes("stored in java memory")) return "Array objects live on the heap, while the local variable holding the reference typically lives in the stack frame of the current method.";
  if (q.includes("time complexity of accessing")) return "Array indexing is O(1) because the address of an element can be computed directly from the base location and offset.";
  if (q.includes("copy arrays")) return "Common copying approaches include loops, System.arraycopy(), Arrays.copyOf(), and clone(), each with slightly different ergonomics and use cases.";
  if (q.includes("performance pitfalls")) return "Common pitfalls include repeated resizing, unnecessary boxing, cache-unfriendly patterns, copying large arrays too often, and using arrays where a different structure better matches the workload.";
  if (q.includes("wave")) return "A wave-order or wave-sort answer should describe the index pattern clearly and then implement the transformation with either direct traversal logic or controlled swaps.";
  if (q.includes("matrix")) return "For matrix questions, a strong answer should explain row/column traversal, bounds safety, and whether the algorithm depends on square or rectangular dimensions.";
  if (q.includes("fibonacci")) return "A strong Fibonacci answer should explain the recurrence, base cases, and why an iterative constant-space version is often preferred over naive recursion.";
  if (q.includes("palindrome")) return "A palindrome solution usually compares mirrored characters from the outside inward, either iteratively with two pointers or recursively with shrinking bounds.";
  if (q.includes("anagram")) return "An anagram solution usually sorts both normalized strings or compares character counts in linear time.";
  if (q.includes("reverse an array")) return "Reversing an array in-place typically uses two pointers that swap values from both ends toward the center.";

  if (s.includes("program")) {
    return "A good answer should describe the algorithm, time and space complexity, edge cases, and then provide a clean Java implementation using readable method names and tests.";
  }

  if (s.includes("scenario")) {
    return "A strong interview answer should describe how you would gather evidence first, isolate the failing component, apply the smallest safe fix, and then add monitoring or tests so the issue is less likely to recur.";
  }

  if (s.includes("memory")) {
    return "A strong answer should connect the concept back to heap behavior, reachability, garbage collection, and practical debugging tools such as heap dumps, GC logs, and profilers.";
  }

  if (s.includes("mcq")) {
    return "A strong answer should define the core Java concept, eliminate the incorrect alternatives based on language rules, and explain the one option that best matches JVM or language behavior.";
  }

  if (s.includes("string")) {
    return "A strong string answer should define the API or behavior clearly, mention immutability where relevant, and include one practical example showing how the method or concept is used in Java code.";
  }

  if (s.includes("array")) {
    return "A strong array answer should explain indexing, complexity, memory behavior, and the exact traversal or in-place update strategy needed by the problem.";
  }

  if (s.includes("collection")) {
    return "A strong collections answer should contrast interface contracts, ordering, null handling, concurrency, and time complexity for the relevant implementation choices.";
  }

  return "This question is best answered by defining the Java concept clearly, contrasting it with the closest alternative when relevant, and then giving one practical example from production code.";
};

const baseTitles = JSON.parse(await fs.readFile(baseDataPath, "utf8"))
  .filter((item) => isUsableQuestion(item.question))
  .map((item) => ({
    section: item.section ?? "",
    question: item.question ?? "",
    sourceLabel: baseSource.label,
    sourceUrl: baseSource.url,
  }));

const supplementalCollections = await Promise.all(
  additionalSources.map((source) => extractQuestionsFromHtml(source)),
);

const combined = [...baseTitles, ...supplementalCollections.flat()];
const deduped = [];
const seenQuestions = new Set();

for (const item of combined) {
  const key = item.question.toLowerCase();
  if (seenQuestions.has(key)) {
    continue;
  }

  seenQuestions.add(key);
  deduped.push({
    ...item,
    generatedAnswer: buildAnswer(item.question, item.section),
  });
}

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Java Questions");

const rows = [
  ["Question #", "Section", "Question Title", "Generated Answer", "Answer Type", "Source", "Source URL", "Capture Note"],
  ...deduped.map((item, index) => [
    index + 1,
    item.section,
    item.question,
    item.generatedAnswer,
    "Project-generated original answer",
    item.sourceLabel,
    item.sourceUrl,
    "Question title extracted from page heading",
  ]),
];

sheet.getRange(`A1:H${rows.length}`).values = rows;
sheet.getRange("A1:H1").format.fill.color = "#0f766e";
sheet.getRange("A1:H1").format.font.bold = true;
sheet.getRange("A1:H1").format.font.color = "#ffffff";
sheet.getRange(`B2:B${rows.length}`).format.wrapText = true;
sheet.getRange(`C2:C${rows.length}`).format.wrapText = true;
sheet.getRange(`D2:D${rows.length}`).format.wrapText = true;
sheet.getRange(`E2:E${rows.length}`).format.wrapText = true;
sheet.getRange(`F2:F${rows.length}`).format.wrapText = true;
sheet.getRange(`G2:G${rows.length}`).format.wrapText = true;
sheet.getRange(`H2:H${rows.length}`).format.wrapText = true;

await fs.mkdir(outputDir, { recursive: true });
const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);

const inspection = await workbook.inspect({
  kind: "table",
  range: "Java Questions!A1:H8",
  include: "values",
  tableMaxRows: 8,
  tableMaxCols: 8,
});

const sourceCounts = deduped.reduce((counts, item) => {
  counts[item.sourceLabel] = (counts[item.sourceLabel] || 0) + 1;
  return counts;
}, {});

console.log(
  JSON.stringify(
    {
      outputPath,
      rowCount: deduped.length,
      sourceCounts,
      preview: inspection.ndjson,
    },
    null,
    2,
  ),
);
