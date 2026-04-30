const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const fetch = require('node-fetch');
const parser = new Parser();

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// File-based persistence helpers
function loadJSON(filename) {
  const filepath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    }
  } catch (e) {
    console.error(`Failed to load ${filename}:`, e.message);
  }
  return null;
}

function saveJSON(filename, data) {
  const filepath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Failed to save ${filename}:`, e.message);
  }
}

// API Key from environment - NEVER exposed to frontend
const API_KEY = process.env.WRITER_TRACKER_API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Key Authentication Middleware
const requireAuth = (req, res, next) => {
  const providedKey = req.headers['x-api-key'] || req.query.api_key;

  if (!API_KEY) {
    return res.status(500).json({
      error: 'API key not configured',
      message: 'Server API key not set. Set WRITER_TRACKER_API_KEY environment variable.'
    });
  }

  if (providedKey !== API_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key'
    });
  }

  next();
};

// Writers data - Modern writers (bilingual)
let modernWriters = [
  {
    id: 'naval-ravikant',
    name: 'Naval Ravikant / Naval Ravikant',
    identity: '硅谷顶级投资人、第一性原理驱动者 / Silicon Valley Top Investor, First Principles Thinker',
    website: 'https://nav.al',
    twitter: 'https://twitter.com/naval',
    articles: [
      { title: 'How to Get Rich / 如何致富', url: 'https://nav.al/rich' },
      { title: 'The Almanack / 年鉴', url: 'https://nav.al/' }
    ]
  },
  {
    id: 'shane-parrish',
    name: 'Shane Parrish / Shane Parrish',
    identity: '跨学科心智模型、复杂系统降维解析 / Cross-disciplinary Mental Models, Complex Systems',
    website: 'https://fs.blog',
    twitter: 'https://x.com/shaneparrish',
    articles: [
      { title: 'Best Articles / 最佳文章', url: 'https://fs.blog/best-articles/' }
    ]
  },
  {
    id: 'adam-grant',
    name: 'Adam Grant / Adam Grant',
    identity: '沃顿商学院教授、组织行为学逆向思维 / Wharton Professor, Organizational Psychology',
    website: 'https://adamgrant.net',
    articles: [
      { title: 'Articles / 文章', url: 'https://adamgrant.net/writing/articles/' },
      { title: 'Substack', url: 'https://adamgrant.substack.com/' }
    ]
  },
  {
    id: 'daniel-kahneman',
    name: 'Daniel Kahneman / Daniel Kahneman',
    identity: '诺贝尔经济学奖得主、行为经济学巨擘 / Nobel Laureate, Behavioral Economics Pioneer',
    website: 'https://scholar.princeton.edu/kahneman',
    articles: [
      { title: 'Princeton Page / 普林斯顿页面', url: 'https://scholar.princeton.edu/kahneman' }
    ]
  },
  {
    id: 'annie-duke',
    name: 'Annie Duke / Annie Duke',
    identity: '前职业扑克冠军、不确定性决策逻辑专家 / Former Pro Poker Champion, Decision Making Expert',
    website: 'https://annieduke.com',
    articles: [
      { title: 'Articles / 文章', url: 'https://www.annieduke.com/tag/article/' }
    ]
  },
  {
    id: 'morgan-housel',
    name: 'Morgan Housel / Morgan Housel',
    identity: '强共情商业叙事、顶级金融专栏作家 / Empathetic Business Narrator, Top Financial Columnist',
    website: 'https://collabfund.com/blog',
    articles: [
      { title: 'Collab Blog / 博客', url: 'https://collabfund.com/blog/' }
    ]
  },
  {
    id: 'james-clear',
    name: 'James Clear / James Clear',
    identity: '习惯学先驱、3-2-1 Newsletter模型构建者 / Habit Expert, 3-2-1 Newsletter Creator',
    website: 'https://jamesclear.com',
    articles: [
      { title: 'Atomic Habits / 原子习惯', url: 'https://jamesclear.com/atomichabits' },
      { title: 'Newsletter / 时事通讯', url: 'https://jamesclear.com/3-2-1/' }
    ]
  },
  {
    id: 'ryan-holiday',
    name: 'Ryan Holiday / Ryan Holiday',
    identity: '斯多葛学派现代化普及者 / Stoicism Modernizer',
    website: 'https://ryanholiday.net',
    articles: [
      { title: 'Best Articles / 最佳文章', url: 'https://ryanholiday.net/best-articles/' }
    ]
  },
  {
    id: 'brene-brown',
    name: 'Brené Brown / Brené Brown',
    identity: '社会学研究学者、同理心驱动共鸣唤醒者 / Social Researcher, Empathy Expert',
    website: 'https://brenebrown.com',
    articles: [
      { title: 'Articles / 文章', url: 'https://brenebrown.com/articles/' }
    ]
  },
  {
    id: 'seth-godin',
    name: 'Seth Godin / Seth Godin',
    identity: '现代营销学泰斗 / Marketing Guru',
    website: 'https://sethgodin.com',
    articles: [
      { title: 'Blog / 博客', url: 'https://seths.blog/' }
    ]
  },
  {
    id: 'ben-thompson',
    name: 'Ben Thompson / Ben Thompson',
    identity: '科技商业评论先锋、聚合理论提出者 / Tech Business Analyst, Aggregation Theory Creator',
    website: 'https://stratechery.com',
    articles: [
      { title: 'Stratechery / 策略分析', url: 'https://stratechery.com/' }
    ]
  },
  {
    id: 'lenny-rachitsky',
    name: 'Lenny Rachitsky / Lenny Rachitsky',
    identity: '产品管理教父 / Product Management Guru',
    website: 'https://lennysnewsletter.com',
    articles: [
      { title: 'Newsletter / 时事通讯', url: 'https://lennysnewsletter.com' }
    ]
  },
  {
    id: 'noah-smith',
    name: 'Noah Smith / Noah Smith',
    identity: '宏观经济与地缘政治数据分析 / Macro Economics & Geopolitics Analyst',
    website: 'https://noahpinion.substack.com',
    articles: [
      { title: 'Noahpinion / 诺亚观点', url: 'https://noahpinion.substack.com' }
    ]
  },
  {
    id: 'azeem-azhar',
    name: 'Azeem Azhar / Azeem Azhar',
    identity: '前沿科技分析、指数级增长探索 / Tech Analyst, Exponential Growth Explorer',
    website: 'https://exponentialview.co',
    articles: [
      { title: 'Exponential View / 指数观点', url: 'https://exponentialview.co' }
    ]
  },
  {
    id: 'gergely-orosz',
    name: 'Gergely Orosz / Gergely Orosz',
    identity: '硅谷工程管理智囊 / Silicon Valley Engineering Management',
    website: 'https://pragmaticengineer.com',
    articles: [
      { title: 'Newsletter / 时事通讯', url: 'https://newsletter.pragmaticengineer.com/' }
    ]
  },
  {
    id: 'david-perell',
    name: 'David Perell / David Perell',
    identity: '写作系统化工程师 / Writing Systematizer',
    website: 'https://perell.com',
    articles: [
      { title: 'Essays / 文章', url: 'https://perell.com/essays/' }
    ]
  },
  {
    id: 'julian-shapiro',
    name: 'Julian Shapiro / Julian Shapiro',
    identity: '独立深度研究者 / Independent Deep Researcher',
    website: 'https://www.julian.com',
    articles: [
      { title: 'Writing Guide / 写作指南', url: 'https://www.julian.com/guide/write/' }
    ]
  },
  {
    id: 'tim-denning',
    name: 'Tim Denning / Tim Denning',
    identity: '高能量情绪输出创作者 / High-Energy Content Creator',
    website: 'https://timdenning.com',
    articles: [
      { title: 'Tim Denning', url: 'https://timdenning.com' }
    ]
  },
  {
    id: 'justin-welsh',
    name: 'Justin Welsh / Justin Welsh',
    identity: '超级个体经济倡导者 / Solopreneur Advocate',
    website: 'https://justinwelsh.me',
    articles: [
      { title: 'Newsletter / 时事通讯', url: 'https://justinwelsh.me/newsletters' }
    ]
  },
  {
    id: 'sahil-bloom',
    name: 'Sahil Bloom / Sahil Bloom',
    identity: '视觉化认知模型专家 / Visual Mental Models Expert',
    website: 'https://sahilbloom.com',
    articles: [
      { title: 'The Curiosity Chronicle / 好奇心编年史', url: 'https://sahilbloom.com' }
    ]
  },
  {
    id: 'amy-edmondson',
    name: 'Amy Edmondson / Amy Edmondson',
    identity: '哈佛商学院教授、"心理安全感"定义者 / Harvard Professor, Psychological Safety Pioneer',
    website: 'https://www.hbs.edu/faculty/Pages/profile.aspx?personId=2962959',
    articles: [
      { title: 'Harvard Profile / 哈佛页面', url: 'https://www.hbs.edu/faculty/Pages/profile.aspx?personId=2962959' }
    ]
  },
  {
    id: 'jim-collins',
    name: 'Jim Collins / Jim Collins',
    identity: '管理学常青框架大师 / Management Framework Master',
    website: 'https://jimcollins.com',
    articles: [
      { title: 'Jim Collins', url: 'https://jimcollins.com' }
    ]
  },
  {
    id: 'rita-mcgrath',
    name: 'Rita McGrath / Rita McGrath',
    identity: '战略拐点研究专家 / Strategy Inflection Point Expert',
    website: 'https://ritamcgrath.com',
    articles: [
      { title: 'Rita McGrath', url: 'https://ritamcgrath.com' }
    ]
  },
  {
    id: 'amy-webb',
    name: 'Amy Webb / Amy Webb',
    identity: '定量未来学家 / Quantitative Futurist',
    website: 'https://futuretodayinstitute.com',
    articles: [
      { title: 'Future Today Institute / 未来今日研究所', url: 'https://futuretodayinstitute.com' }
    ]
  },
  {
    id: 'scott-anthony',
    name: 'Scott D. Anthony / Scott D. Anthony',
    identity: '创新战略顾问 / Innovation Strategy Consultant',
    website: 'https://innosight.com',
    articles: [
      { title: 'Innosight', url: 'https://innosight.com' }
    ]
  },
  {
    id: 'peter-winick',
    name: 'Peter Winick / Peter Winick',
    identity: '思想领导力商业变现专家 / Thought Leadership Monetization Expert',
    website: 'https://thoughtleadershipleverage.com',
    articles: [
      { title: 'Thought Leadership Leverage', url: 'https://thoughtleadershipleverage.com' }
    ]
  },
  {
    id: 'paul-polman',
    name: 'Paul Polman / Paul Polman',
    identity: '可持续发展倡导者 / Sustainability Advocate',
    website: 'https://paulpolman.com',
    articles: [
      { title: 'Paul Polman', url: 'https://paulpolman.com' }
    ]
  },
  {
    id: 'simon-sinek',
    name: 'Simon Sinek / Simon Sinek',
    identity: '黄金圈法则提出者 / Golden Circle Creator',
    website: 'https://simonsinek.com',
    articles: [
      { title: 'Simon Sinek', url: 'https://simonsinek.com' }
    ]
  },
  {
    id: 'richard-branson',
    name: 'Richard Branson / Richard Branson',
    identity: '企业家冒险家 / Entrepreneur Adventurer',
    website: 'https://www.virgin.com/richard-branson',
    articles: [
      { title: 'Virgin / 维珍', url: 'https://www.virgin.com/richard-branson' }
    ]
  },
  {
    id: 'gini-dietrich',
    name: 'Gini Dietrich / Gini Dietrich',
    identity: 'PESO模型提出者 / PESO Model Creator',
    website: 'https://spinsucks.com',
    articles: [
      { title: 'Spin Sucks', url: 'https://spinsucks.com' }
    ]
  },
  // ========== AI Newsletters ==========
  {
    id: 'bens-bites',
    name: "Ben's Bites / Ben's Bites",
    identity: 'AI应用层创业生态深度追踪, 120K+风投与创始人订阅 / AI Application Layer Startup Ecosystem, 120K+ VCs & Founders',
    website: 'https://bensbites.com',
    articles: [
      { title: "Ben's Bites / 订阅", url: 'https://bensbites.com' }
    ]
  },
  {
    id: 'datanorth-ai',
    name: 'DataNorth AI / DataNorth AI',
    identity: '企业级AI战略与ROI落地, 150K+企业高管订阅 / Enterprise AI Strategy & ROI, 150K+ Executives',
    website: 'https://datanorth.ai',
    articles: [
      { title: 'Blog / 博客', url: 'https://datanorth.ai/blog' }
    ]
  },
  {
    id: 'alphasignal',
    name: 'AlphaSignal / AlphaSignal',
    identity: '硬核AI技术论文与模型追踪, 180K+ ML工程师订阅 / Top 1% AI Research & Model Updates, 180K+ ML Engineers',
    website: 'https://alphasignal.ai',
    articles: [
      { title: 'AlphaSignal / 订阅', url: 'https://alphasignal.ai' }
    ]
  },
  {
    id: 'turing-post',
    name: 'Turing Post / Turing Post',
    identity: '地缘政治与宏观AI治理, 95K+政策顾问与宏观投资者订阅 / Geopolitics & AI Governance, 95K+ Policy Advisors & Macro Investors',
    website: 'https://www.turingpost.com',
    articles: [
      { title: 'Turing Post / 订阅', url: 'https://www.turingpost.com' }
    ]
  },
  {
    id: 'genai-works',
    name: 'The Atlas / GenAI.Works / 生成式AI日报',
    identity: '全球最大AI社区, 1M+全行业从业者订阅, 专注初创生态与实战部署 / Largest AI Community, 1M+ Subscribers, Startup Ecosystem & Deployment',
    website: 'https://genai.works',
    articles: [
      { title: 'Newsletter / 订阅', url: 'https://newsletter.genai.works' },
      { title: 'Insights / 洞察', url: 'https://genai.works/insights' }
    ]
  },
  {
    id: 'doomberg',
    name: 'Doomberg / Doomberg',
    identity: '能源金融地缘政治深度分析, Substack顶级财经通讯 / Energy, Finance & Geopolitics Analysis, Top Finance Substack',
    website: 'https://newsletter.doomberg.com',
    articles: [
      { title: 'About / 关于', url: 'https://newsletter.doomberg.com/about' }
    ]
  },
  {
    id: 'prospero-ai',
    name: 'Prospero.Ai / Prospero.Ai',
    identity: 'AI量化股票分析平台, 机器学习驱动的二级市场信号 / AI-Powered Stock Analysis, ML-Driven Market Signals',
    website: 'https://www.prospero.ai',
    articles: [
      { title: 'Resources / 资源', url: 'https://www.prospero.ai/resources-blog' }
    ]
  },
  // ========== AI Podcasts ==========
  {
    id: 'latent-space',
    name: 'Latent Space / Latent Space',
    identity: 'AI工程师深度访谈播客, 基础模型架构与智能体部署实战 / AI Engineer Deep-Dive Podcast, Foundation Models & Agent Deployment',
    website: 'https://www.latent.space',
    articles: [
      { title: 'Podcast / 播客', url: 'https://www.latent.space' }
    ]
  },
  {
    id: 'dwarkesh-podcast',
    name: 'Dwarkesh Podcast / Dwarkesh Podcast',
    identity: '深度长访谈播客, AGI演进路线与缩放定律理论边界 / Deep Long-Form Interviews, AGI Roadmap & Scaling Laws Theory',
    website: 'https://www.dwarkeshpatel.com',
    articles: [
      { title: 'Podcast / 播客', url: 'https://www.dwarkeshpatel.com' }
    ]
  },
  {
    id: 'cognitive-revolution',
    name: 'The Cognitive Revolution / 认知革命播客',
    identity: '生成式AI商业与社会分析播客, 经济部门颠覆与深远文化影响 / GenAI Business & Society Analysis, Economic Disruption & Cultural Impact',
    website: 'https://www.cognitiverevolution.ai',
    articles: [
      { title: 'Podcast / 播客', url: 'https://www.cognitiverevolution.ai' }
    ]
  },
  {
    id: 'no-priors',
    name: 'No Priors / No Priors',
    identity: '顶级VC创投对谈播客, 由Sarah Guo与Elad Gil主持, 专注AI颠覆时机与护城河 / Top VC Podcast by Sarah Guo & Elad Gil, AI Disruption Timing & Startup Moats',
    website: 'https://feeds.megaphone.fm/nopriors',
    articles: [
      { title: 'Apple Podcasts / 苹果播客', url: 'https://podcasts.apple.com/us/podcast/no-priors-artificial-intelligence-machine-learning/id1668002688' }
    ]
  },
  {
    id: 'lex-fridman',
    name: 'Lex Fridman Podcast / Lex Fridman播客',
    identity: '马拉松式深度长谈播客, 科学哲学AI与人类智能本质 / Marathon Long-Form Conversations, Science, Philosophy & AI',
    website: 'https://lexfridman.com',
    articles: [
      { title: 'Podcast / 播客', url: 'https://lexfridman.com/podcast' }
    ]
  },
  // ========== AI Influencers & KOLs ==========
  {
    id: 'yann-lecun',
    name: 'Yann LeCun / Yann LeCun',
    identity: 'Meta首席AI科学家, 世界模型与开源生态旗手, 图灵奖得主 / Meta Chief AI Scientist, World Models & Open Source Champion, Turing Award Winner',
    website: 'http://yann.lecun.com',
    articles: [
      { title: 'Homepage / 主页', url: 'http://yann.lecun.com' }
    ]
  },
  {
    id: 'andrej-karpathy',
    name: 'Andrej Karpathy / Andrej Karpathy',
    identity: '前特斯拉与OpenAI科学家, LLM与深度学习架构科普权威 / Ex-Tesla & OpenAI Scientist, LLM & Deep Learning Educator',
    website: 'https://karpathy.ai',
    articles: [
      { title: 'Homepage / 主页', url: 'https://karpathy.ai' }
    ]
  },
  {
    id: 'allie-k-miller',
    name: 'Allie K. Miller / Allie K. Miller',
    identity: '前AWS全球ML负责人, AI商业应用顶级顾问, TIME100 AI影响力人物 / Ex-AWS Global ML Head, Top AI Business Advisor, TIME100 AI Influencer',
    website: 'https://www.alliekmiller.com',
    articles: [
      { title: 'Homepage / 主页', url: 'https://www.alliekmiller.com' }
    ]
  },
  {
    id: 'cassie-kozyrkov',
    name: 'Cassie Kozyrkov / Cassie Kozyrkov',
    identity: '前谷歌首席决策科学家, 决策智能领域创始人, 培训2万+谷歌员工 / Ex-Google Chief Decision Scientist, Decision Intelligence Pioneer, Trained 20K+ Googlers',
    website: 'https://www.kozyr.com',
    articles: [
      { title: 'KOZYR / 主页', url: 'https://www.kozyr.com' }
    ]
  },
  {
    id: 'fei-fei-li',
    name: 'Fei-Fei Li (李飞飞) / Fei-Fei Li',
    identity: '斯坦福大学教授, 空间AI与计算机视觉先驱, World Labs创始人 / Stanford Professor, Spatial AI & Computer Vision Pioneer, World Labs Founder',
    website: 'https://profiles.stanford.edu/fei-fei-li',
    articles: [
      { title: 'Stanford Profile / 斯坦福主页', url: 'https://profiles.stanford.edu/fei-fei-li' }
    ]
  },
  {
    id: 'ethan-mollick',
    name: 'Ethan Mollick / Ethan Mollick',
    identity: '沃顿商学院教授, 生成式AI生产力与工作未来研究权威 / Wharton Professor, GenAI Productivity & Future of Work Research Pioneer',
    website: 'https://www.oneusefulthing.org',
    articles: [
      { title: 'One Useful Thing / 主页', url: 'https://www.oneusefulthing.org' }
    ]
  }
];

// Historical writers (bilingual)
let historicalWriters = [
  {
    id: 'homer',
    name: '荷马 (Homer)',
    era: '古希腊时代 / Ancient Greece',
    masterpiece: '《伊利亚特》《奥德赛》/ Iliad, Odyssey',
    description: '史诗级命运决定论 / Epic fatalism'
  },
  {
    id: 'sophocles',
    name: '索福克勒斯 (Sophocles)',
    era: '古希腊悲剧巅峰 / Golden Age of Greek Tragedy',
    masterpiece: '《俄狄浦斯王》/ Oedipus Rex',
    description: '完美古典戏剧力学 / Perfect dramatic mechanics'
  },
  {
    id: 'virgil',
    name: '维吉尔 (Virgil)',
    era: '古罗马奥古斯都时代 / Roman Augustan Age',
    masterpiece: '《埃涅阿斯纪》/ Aeneid',
    description: '帝国神话政治叙事 / Imperial mythology'
  },
  {
    id: 'dante',
    name: '但丁 (Dante Alighieri)',
    era: '中世纪晚期 / Late Medieval',
    masterpiece: '《神曲》/ Divine Comedy',
    description: '几何学般宇宙神学架构 / Geometrical theology'
  },
  {
    id: 'shakespeare',
    name: '莎士比亚 (William Shakespeare)',
    era: '英国伊丽莎白时代 / Elizabethan England',
    masterpiece: '《哈姆雷特》《李尔王》/ Hamlet, King Lear',
    description: '人性深渊全景显微镜 / Human nature microscope'
  },
  {
    id: 'voltaire',
    name: '伏尔泰 (Voltaire)',
    era: '法国启蒙运动 / French Enlightenment',
    masterpiece: '《老实人》/ Candide',
    description: '理性主义讽刺之刃 / Satirical rationalism'
  },
  {
    id: 'jane-austen',
    name: '简·奥斯汀 (Jane Austen)',
    era: '英国摄政时期 / British Regency',
    masterpiece: '《傲慢与偏见》/ Pride and Prejudice',
    description: '社会博弈论微观剖析 / Social game theory'
  },
  {
    id: 'charles-dickens',
    name: '查尔斯·狄更斯 (Charles Dickens)',
    era: '英国维多利亚时代 / Victorian England',
    masterpiece: '《双城记》《远大前程》/ A Tale of Two Cities, Great Expectations',
    description: '厚重社会批判 / Thick social critique'
  },
  {
    id: 'fyodor-dostoevsky',
    name: '陀思妥耶夫斯基 (Fyodor Dostoevsky)',
    era: '俄国十九世纪黄金时代 / Russian Golden Age',
    masterpiece: '《罪与罚》《卡拉马佐夫兄弟》/ Crime and Punishment, Brothers Karamazov',
    description: '极限环境多声部心理学 /极限 psychology'
  },
  {
    id: 'leo-tolstoy',
    name: '列夫·托尔斯泰 (Leo Tolstoy)',
    era: '俄国十九世纪黄金时代 / Russian Golden Age',
    masterpiece: '《战争与和平》/ War and Peace',
    description: '全知视角上帝历史哲学 / Omniscient historical philosophy'
  },
  {
    id: 'franz-kafka',
    name: '弗兰兹·卡夫卡 (Franz Kafka)',
    era: '二十世纪初 / Early 20th Century',
    masterpiece: '《变形记》《审判》/ Metamorphosis, The Trial',
    description: '冷酷说明性异化荒诞 / Cold alienating absurdity'
  },
  {
    id: 'james-joyce',
    name: '詹姆斯·乔伊斯 (James Joyce)',
    era: '爱尔兰现代主义 / Irish Modernism',
    masterpiece: '《尤利西斯》/ Ulysses',
    description: '时间与语言力学重建 / Time and language destruction'
  },
  {
    id: 'george-orwell',
    name: '乔治·奥威尔 (George Orwell)',
    era: '英国二十世纪中期 / Mid 20th Century Britain',
    masterpiece: '《1984》《动物庄园》/ 1984, Animal Farm',
    description: '语言与权力解剖学 / Language and power anatomy'
  }
];

// Articles data
let articles = [];
let nextArticleId = 1;
let updateHistory = {};
let lastChecked = {};
let requests = [];

// Load persisted data or seed from defaults
function initData() {
  // Load writers — merge persisted with hardcoded defaults
  const savedWriters = loadJSON('writers.json');
  if (savedWriters && savedWriters.modern && savedWriters.historical) {
    // Merge: keep all persisted writers, add any new hardcoded ones
    const persistedModernIds = new Set(savedWriters.modern.map(w => w.id));
    const persistedHistoricalIds = new Set(savedWriters.historical.map(w => w.id));
    const newModern = modernWriters.filter(w => !persistedModernIds.has(w.id));
    const newHistorical = historicalWriters.filter(w => !persistedHistoricalIds.has(w.id));
    modernWriters = [...savedWriters.modern, ...newModern];
    historicalWriters = [...savedWriters.historical, ...newHistorical];
    if (newModern.length > 0 || newHistorical.length > 0) {
      saveJSON('writers.json', { modern: modernWriters, historical: historicalWriters });
      console.log(`  Merged ${newModern.length} new modern + ${newHistorical.length} new historical writers`);
    }
    console.log(`  Loaded ${modernWriters.length} modern + ${historicalWriters.length} historical writers from disk`);
  } else {
    saveJSON('writers.json', { modern: modernWriters, historical: historicalWriters });
    console.log(`  Seeded ${modernWriters.length} modern + ${historicalWriters.length} historical writers`);
  }

  // Load articles
  const savedArticles = loadJSON('articles.json');
  if (savedArticles) {
    articles = savedArticles;
    articles.forEach(a => {
      const numId = parseInt(a.id.replace('a-', ''));
      if (numId >= nextArticleId) nextArticleId = numId + 1;
    });
    console.log(`  Loaded ${articles.length} articles from disk`);
  }

  // Load updates
  const savedUpdates = loadJSON('updates.json');
  if (savedUpdates) {
    updateHistory = savedUpdates.history || {};
    lastChecked = savedUpdates.lastChecked || {};
  }

  // Load requests
  const savedRequests = loadJSON('requests.json');
  if (savedRequests) {
    requests = savedRequests;
  }

  // Load state
  const savedState = loadJSON('state.json');
  if (savedState && savedState.nextArticleId) {
    nextArticleId = savedState.nextArticleId;
  }

  // Init updateHistory for writers without entries
  modernWriters.forEach(writer => {
    if (!updateHistory[writer.id]) updateHistory[writer.id] = [];
    if (!lastChecked[writer.id]) lastChecked[writer.id] = null;
  });
}

function saveState() {
  saveJSON('state.json', { nextArticleId });
}

function saveArticles() {
  saveJSON('articles.json', articles);
}

function saveWriters() {
  saveJSON('writers.json', { modern: modernWriters, historical: historicalWriters });
}

function saveUpdates() {
  saveJSON('updates.json', { history: updateHistory, lastChecked });
}

function saveRequests() {
  saveJSON('requests.json', requests);
}

// Helper: generate unique article ID
function generateArticleId() {
  return `a-${nextArticleId++}`;
}

// Helper: resolve writer name from ID
function getWriterName(writerId) {
  const writer = modernWriters.find(w => w.id === writerId);
  return writer ? writer.name : 'Unknown';
}

// Helper: get all unique tags across articles
function getAllTags() {
  const tagSet = new Set();
  articles.forEach(a => {
    if (Array.isArray(a.tags)) a.tags.forEach(t => tagSet.add(t.toLowerCase()));
  });
  return [...tagSet].sort();
}

// ==================== ARTICLE PUBLIC ENDPOINTS ====================

// List articles with filters
app.get('/api/articles', (req, res) => {
  const { tag, writerId, source, sort, limit } = req.query;
  let result = [...articles];

  if (tag) {
    const t = tag.toLowerCase();
    result = result.filter(a => a.tags && a.tags.some(tg => tg.toLowerCase() === t));
  }
  if (writerId) {
    result = result.filter(a => a.writerId === writerId);
  }
  if (source) {
    result = result.filter(a => a.source === source);
  }

  const sortOrder = sort === 'oldest' ? 1 : -1;
  result.sort((a, b) => {
    const da = a.publishedAt || a.createdAt || '';
    const db = b.publishedAt || b.createdAt || '';
    return sortOrder * da.localeCompare(db);
  });

  const maxLimit = Math.min(parseInt(limit) || 50, 200);
  result = result.slice(0, maxLimit);

  res.json({
    articles: result,
    total: articles.length,
    tags: getAllTags()
  });
});

// Article feed for focus carousel
app.get('/api/articles/feed', (req, res) => {
  const count = Math.min(parseInt(req.query.count) || 5, 20);
  const sorted = [...articles].sort((a, b) => {
    const da = a.publishedAt || a.createdAt || '';
    const db = b.publishedAt || b.createdAt || '';
    return db.localeCompare(da);
  });
  res.json(sorted.slice(0, count));
});

// Get all tags
app.get('/api/articles/tags', (req, res) => {
  res.json({ tags: getAllTags() });
});

// Get single article
app.get('/api/articles/:id', (req, res) => {
  const article = articles.find(a => a.id === req.params.id);
  if (!article) {
    return res.status(404).json({ error: 'Article not found' });
  }
  res.json(article);
});

// ==================== PUBLIC READ API ====================

// Get all writers (public)
app.get('/api/writers', (req, res) => {
  res.json({
    modern: modernWriters,
    historical: historicalWriters,
    total: {
      modern: modernWriters.length,
      historical: historicalWriters.length
    }
  });
});

// Get modern writers only (public)
app.get('/api/writers/modern', (req, res) => {
  res.json(modernWriters);
});

// Get historical writers only (public)
app.get('/api/writers/historical', (req, res) => {
  res.json(historicalWriters);
});

// Get single writer by ID (public)
app.get('/api/writers/:id', (req, res) => {
  const { id } = req.params;
  const writer = modernWriters.find(w => w.id === id) || historicalWriters.find(w => w.id === id);
  if (!writer) {
    return res.status(404).json({ error: 'Writer not found' });
  }
  res.json(writer);
});

// Search writers (public)
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  const query = q.toLowerCase();
  const results = {
    modern: modernWriters.filter(w =>
      w.name.toLowerCase().includes(query) ||
      w.identity.toLowerCase().includes(query) ||
      w.website.toLowerCase().includes(query)
    ),
    historical: historicalWriters.filter(w =>
      w.name.toLowerCase().includes(query) ||
      w.masterpiece.toLowerCase().includes(query) ||
      w.description.toLowerCase().includes(query)
    )
  };

  res.json(results);
});

// Check for updates (public - no auth needed for reading)
app.get('/api/check-updates/:id', async (req, res) => {
  const { id } = req.params;
  const writer = modernWriters.find(w => w.id === id);

  if (!writer) {
    return res.status(404).json({ error: 'Modern writer not found' });
  }

  try {
    const rssUrls = [
      `${writer.website}/feed`,
      `${writer.website}/rss`,
      `${writer.website}/atom.xml`
    ];

    if (writer.articles[0]?.url?.includes('substack')) {
      const substackMatch = writer.articles[0].url.match(/https?:\/\/([^\.]+)\.substack\.com/);
      if (substackMatch) {
        rssUrls.unshift(`https://${substackMatch[1]}.substack.com/feed`);
      }
    }

    let latestUpdate = null;

    for (const rssUrl of rssUrls) {
      try {
        const feed = await parser.parseURL(rssUrl);
        if (feed.items && feed.items.length > 0) {
          latestUpdate = {
            title: feed.items[0].title,
            url: feed.items[0].link,
            date: feed.items[0].pubDate,
            source: rssUrl
          };

          if (!updateHistory[id]) updateHistory[id] = [];
          updateHistory[id].unshift({ ...latestUpdate, checkedAt: new Date().toISOString() });
          updateHistory[id] = updateHistory[id].slice(0, 50);
          lastChecked[id] = new Date().toISOString();
          break;
        }
      } catch (e) {}
    }

    res.json({
      writer: writer,
      lastChecked: lastChecked[id],
      latestUpdate: latestUpdate,
      history: updateHistory[id]?.slice(0, 10) || []
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to check updates', details: error.message });
  }
});

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!API_KEY
  });
});

// ==================== PROTECTED WRITE API (requires API key) ====================

// Add new modern writer
app.post('/api/writers/modern', requireAuth, (req, res) => {
  const { id, name, identity, website, articles } = req.body;

  if (!id || !name || !website) {
    return res.status(400).json({ error: 'id, name, and website are required' });
  }

  if (modernWriters.find(w => w.id === id)) {
    return res.status(409).json({ error: 'Writer with this ID already exists' });
  }

  const newWriter = {
    id,
    name: name,
    identity: identity || '',
    website,
    twitter: req.body.twitter || '',
    articles: articles || []
  };

  modernWriters.push(newWriter);
  updateHistory[id] = [];
  saveWriters();
  saveUpdates();

  res.status(201).json({ success: true, writer: newWriter });
});

// Update existing modern writer
app.put('/api/writers/modern/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const index = modernWriters.findIndex(w => w.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Writer not found' });
  }

  const { name, identity, website, twitter, articles } = req.body;

  if (name) modernWriters[index].name = name;
  if (identity) modernWriters[index].identity = identity;
  if (website) modernWriters[index].website = website;
  if (twitter !== undefined) modernWriters[index].twitter = twitter;
  if (articles) modernWriters[index].articles = articles;

  saveWriters();
  res.json({ success: true, writer: modernWriters[index] });
});

// Delete modern writer
app.delete('/api/writers/modern/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const index = modernWriters.findIndex(w => w.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Writer not found' });
  }

  const deleted = modernWriters.splice(index, 1)[0];
  delete updateHistory[id];
  saveWriters();
  saveUpdates();

  res.json({ success: true, deleted });
});

// Add new historical writer
app.post('/api/writers/historical', requireAuth, (req, res) => {
  const { id, name, era, masterpiece, description } = req.body;

  if (!id || !name || !masterpiece) {
    return res.status(400).json({ error: 'id, name, and masterpiece are required' });
  }

  if (historicalWriters.find(w => w.id === id)) {
    return res.status(409).json({ error: 'Writer with this ID already exists' });
  }

  const newWriter = {
    id,
    name,
    era: era || '',
    masterpiece,
    description: description || ''
  };

  historicalWriters.push(newWriter);
  saveWriters();

  res.status(201).json({ success: true, writer: newWriter });
});

// Update existing historical writer
app.put('/api/writers/historical/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const index = historicalWriters.findIndex(w => w.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Writer not found' });
  }

  const { name, era, masterpiece, description } = req.body;

  if (name) historicalWriters[index].name = name;
  if (era) historicalWriters[index].era = era;
  if (masterpiece) historicalWriters[index].masterpiece = masterpiece;
  if (description) historicalWriters[index].description = description;

  saveWriters();
  res.json({ success: true, writer: historicalWriters[index] });
});

// Delete historical writer
app.delete('/api/writers/historical/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const index = historicalWriters.findIndex(w => w.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Writer not found' });
  }

  const deleted = historicalWriters.splice(index, 1)[0];
  saveWriters();

  res.json({ success: true, deleted });
});

// Add article to a modern writer
app.post('/api/writers/modern/:id/articles', requireAuth, (req, res) => {
  const { id } = req.params;
  const writer = modernWriters.find(w => w.id === id);

  if (!writer) {
    return res.status(404).json({ error: 'Writer not found' });
  }

  const { title, url } = req.body;
  if (!title || !url) {
    return res.status(400).json({ error: 'title and url are required' });
  }

  writer.articles.push({ title, url });

  res.status(201).json({ success: true, articles: writer.articles });
});

// Delete article from a modern writer
app.delete('/api/writers/modern/:id/articles', requireAuth, (req, res) => {
  const { id } = req.params;
  const writer = modernWriters.find(w => w.id === id);

  if (!writer) {
    return res.status(404).json({ error: 'Writer not found' });
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'url query parameter is required' });
  }

  const initialLength = writer.articles.length;
  writer.articles = writer.articles.filter(a => a.url !== url);

  if (writer.articles.length === initialLength) {
    return res.status(404).json({ error: 'Article not found' });
  }

  res.json({ success: true, articles: writer.articles });
});

// Get update history (requires auth)
app.get('/api/updates/history', requireAuth, (req, res) => {
  res.json(updateHistory);
});

// Get specific writer history (requires auth)
app.get('/api/updates/history/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  if (!updateHistory[id]) {
    return res.status(404).json({ error: 'No history found for this writer' });
  }
  res.json({
    writerId: id,
    history: updateHistory[id],
    lastChecked: lastChecked[id]
  });
});

// ==================== PROTECTED ARTICLE ENDPOINTS ====================

// Add article manually
app.post('/api/articles', requireAuth, (req, res) => {
  const { title, url, writerId, tags, excerpt, content, publishedAt } = req.body;

  if (!title || !url || !writerId) {
    return res.status(400).json({ error: 'title, url, and writerId are required' });
  }

  if (!modernWriters.find(w => w.id === writerId)) {
    return res.status(400).json({ error: 'writerId does not match any modern writer' });
  }

  if (articles.find(a => a.url === url)) {
    return res.status(409).json({ error: 'Article with this URL already exists' });
  }

  const article = {
    id: generateArticleId(),
    title,
    url,
    writerId,
    writerName: getWriterName(writerId),
    tags: tags || [],
    excerpt: excerpt || '',
    content: content || '',
    contentSnippet: '',
    source: 'manual',
    publishedAt: publishedAt || new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  articles.push(article);
  saveArticles();
  saveState();
  res.status(201).json({ success: true, article });
});

// Update article
app.put('/api/articles/:id', requireAuth, (req, res) => {
  const article = articles.find(a => a.id === req.params.id);
  if (!article) {
    return res.status(404).json({ error: 'Article not found' });
  }

  const { title, url, writerId, tags, excerpt, content, publishedAt } = req.body;

  if (title) article.title = title;
  if (url !== undefined) article.url = url;
  if (tags) article.tags = tags;
  if (excerpt !== undefined) article.excerpt = excerpt;
  if (content !== undefined) article.content = content;
  if (publishedAt) article.publishedAt = publishedAt;

  if (writerId) {
    if (!modernWriters.find(w => w.id === writerId)) {
      return res.status(400).json({ error: 'writerId does not match any modern writer' });
    }
    article.writerId = writerId;
    article.writerName = getWriterName(writerId);
  }

  saveArticles();
  res.json({ success: true, article });
});

// Delete article
app.delete('/api/articles/:id', requireAuth, (req, res) => {
  const index = articles.findIndex(a => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Article not found' });
  }

  const deleted = articles.splice(index, 1)[0];
  saveArticles();
  res.json({ success: true, deleted });
});

// Bulk RSS fetch
app.post('/api/fetch-articles', requireAuth, async (req, res) => {
  const { writerId } = req.query;
  const writers = writerId
    ? modernWriters.filter(w => w.id === writerId)
    : modernWriters;

  let fetched = 0;
  let newArticles = 0;
  let skipped = 0;

  for (const writer of writers) {
    const rssUrls = [
      `${writer.website}/feed`,
      `${writer.website}/rss`,
      `${writer.website}/atom.xml`
    ];

    if (writer.articles && writer.articles[0]?.url?.includes('substack')) {
      const substackMatch = writer.articles[0].url.match(/https?:\/\/([^\.]+)\.substack\.com/);
      if (substackMatch) {
        rssUrls.unshift(`https://${substackMatch[1]}.substack.com/feed`);
      }
    }

    for (const rssUrl of rssUrls) {
      try {
        const feed = await parser.parseURL(rssUrl);
        if (feed.items && feed.items.length > 0) {
          for (const item of feed.items) {
            fetched++;
            const articleUrl = item.link;
            if (articles.find(a => a.url === articleUrl)) {
              skipped++;
              continue;
            }

            const article = {
              id: generateArticleId(),
              title: item.title || 'Untitled',
              url: articleUrl,
              writerId: writer.id,
              writerName: writer.name,
              tags: [],
              excerpt: item.contentSnippet || '',
              content: item['content:encoded'] || item.content || '',
              contentSnippet: item.contentSnippet || '',
              source: 'rss',
              publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
              createdAt: new Date().toISOString()
            };

            articles.push(article);
            newArticles++;
          }
          break;
        }
      } catch (e) {}
    }
  }

  if (newArticles > 0) {
    saveArticles();
    saveState();
  }
  res.json({ fetched, new: newArticles, skipped });
});

// ==================== WRITER REQUEST ENDPOINTS ====================

// Optional email sending via nodemailer
let nodemailer = null;
let mailTransporter = null;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_TO = process.env.SMTP_TO;

if (SMTP_HOST && SMTP_TO) {
  try {
    nodemailer = require('nodemailer');
    mailTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: parseInt(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    });
    console.log(`  Email: Configured (${SMTP_HOST} → ${SMTP_TO})`);
  } catch (e) {
    console.log(`  Email: Failed to configure: ${e.message}`);
  }
}

function getNextRequestId() {
  const ids = requests.map(r => parseInt(r.id.replace('req-', '')) || 0);
  return 'req-' + (ids.length > 0 ? Math.max(...ids) + 1 : 1);
}

// Submit a writer request (public, no auth needed)
app.post('/api/requests', async (req, res) => {
  const { writerName, website, reason } = req.body;

  if (!writerName || writerName.trim().length === 0) {
    return res.status(400).json({ error: 'writerName is required' });
  }

  const request = {
    id: getNextRequestId(),
    writerName: writerName.trim(),
    website: (website || '').trim(),
    reason: (reason || '').trim(),
    submittedAt: new Date().toISOString()
  };

  requests.push(request);
  saveRequests();

  // Try sending email if configured
  if (mailTransporter && SMTP_TO) {
    try {
      await mailTransporter.sendMail({
        from: process.env.SMTP_USER || SMTP_TO,
        to: SMTP_TO,
        subject: `Writer Tracker: New writer request - ${request.writerName}`,
        text: [
          `New writer request:`,
          ``,
          `Writer: ${request.writerName}`,
          `Website: ${request.website || 'Not provided'}`,
          `Reason: ${request.reason || 'Not provided'}`,
          ``,
          `Submitted: ${request.submittedAt}`,
          ``,
          `Manage: http://localhost:${PORT}/api/requests (requires API key)`
        ].join('\n')
      });
      console.log(`  Email sent for request ${request.id}`);
    } catch (e) {
      console.log(`  Email failed for request ${request.id}: ${e.message}`);
      // Don't fail the request if email fails
    }
  }

  res.status(201).json({ success: true, request });
});

// List all requests (protected)
app.get('/api/requests', requireAuth, (req, res) => {
  res.json({ requests, total: requests.length });
});

// Delete a request (protected)
app.delete('/api/requests/:id', requireAuth, (req, res) => {
  const index = requests.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Request not found' });
  }
  const deleted = requests.splice(index, 1)[0];
  saveRequests();
  res.json({ success: true, deleted });
});

// ==================== ARTICLE PROXY & DOWNLOAD ====================

// SSRF protection: validate URL is safe to fetch
function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    const hostname = parsed.hostname;
    // Block localhost and private IPs
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)) return false;
    if (hostname.startsWith('10.') || hostname.startsWith('172.16.') ||
        hostname.startsWith('192.168.') || hostname.startsWith('169.254.')) return false;
    if (hostname.match(/^127\.\d+\.\d+\.\d+$/)) return false;

    return true;
  } catch (e) {
    return false;
  }
}

// Proxy fetch article content
app.get('/api/articles/:id/proxy', async (req, res) => {
  const article = articles.find(a => a.id === req.params.id);
  if (!article) {
    return res.status(404).json({ error: 'Article not found' });
  }

  if (!isSafeUrl(article.url)) {
    return res.status(400).json({ error: 'Unsafe URL' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(article.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'WriterTracker/1.0' }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(502).json({ error: `Could not fetch article: HTTP ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'text/html';
    let body = await response.text();

    // Limit response size to 5MB
    if (body.length > 5 * 1024 * 1024) {
      body = body.substring(0, 5 * 1024 * 1024);
    }

    res.set('Content-Type', contentType);
    res.send(body);
  } catch (error) {
    res.status(502).json({ error: 'Failed to fetch article', details: error.message });
  }
});

// Download article as markdown
app.get('/api/articles/:id/markdown', (req, res) => {
  const article = articles.find(a => a.id === req.params.id);
  if (!article) {
    return res.status(404).json({ error: 'Article not found' });
  }

  const body = article.content || article.contentSnippet || article.excerpt || 'No content available.';
  const tags = (article.tags || []).join(', ');
  const published = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('zh-CN') : 'Unknown';

  const markdown = [
    `# ${article.title}`,
    '',
    `**Author:** ${article.writerName}`,
    `**Published:** ${published}`,
    `**Tags:** ${tags || 'none'}`,
    `**Original:** [${article.url}](${article.url})`,
    '',
    '---',
    '',
    body
  ].join('\n');

  // Sanitize filename
  const filename = article.title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60) + '.md';

  res.set('Content-Type', 'text/markdown; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(markdown);
});

// Initialize data from disk
initData();

app.listen(PORT, () => {
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`  Writer Tracker API running on http://localhost:${PORT}`);
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`  Writers: ${modernWriters.length} modern + ${historicalWriters.length} historical`);
  console.log(`  API Key: ${API_KEY ? 'Configured ✓' : 'NOT SET - Set WRITER_TRACKER_API_KEY env var'}`);
  console.log(`═══════════════════════════════════════════════════════════`);
});