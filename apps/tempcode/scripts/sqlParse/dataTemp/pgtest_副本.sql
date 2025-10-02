-- 创建一个名为 public 的 schema（如果尚不存在）
CREATE SCHEMA IF NOT EXISTS public;

-- 用户表，用于存储用户信息
CREATE TABLE
    public.users (
        user_id SERIAL PRIMARY KEY, -- 用户ID，自增
        username VARCHAR(50) UNIQUE NOT NULL, -- 用户名，唯一且不能为空
        email VARCHAR(100) UNIQUE NOT NULL, -- 用户邮箱，唯一且不能为空
        password_hash TEXT NOT NULL, -- 用户密码，存储加密后的密码
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间，默认当前时间
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 更新时间，默认当前时间
        CONSTRAINT username_check CHECK (length (username) > 0) -- 用户名不能为空
    );

-- 给表添加注释
COMMENT ON TABLE public.users IS '存储用户信息的表';

-- 给字段添加注释
COMMENT ON COLUMN public.users.user_id IS '用户的唯一标识符';

COMMENT ON COLUMN public.users.username IS '用户的登录用户名';

COMMENT ON COLUMN public.users.email IS '用户的邮箱地址';

COMMENT ON COLUMN public.users.password_hash IS '用户加密后的密码';

COMMENT ON COLUMN public.users.created_at IS '用户创建时间';

COMMENT ON COLUMN public.users.updated_at IS '用户信息最后更新时间';

-- 文章表，用于存储文章信息
CREATE TABLE
    public.articles (
        article_id SERIAL PRIMARY KEY, -- 文章ID，自增
        title VARCHAR(255) NOT NULL, -- 文章标题
        content TEXT NOT NULL, -- 文章内容
        author_id INT REFERENCES public.users (user_id) ON DELETE CASCADE, -- 作者ID，引用用户表
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间，默认当前时间
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 更新时间，默认当前时间
    );

-- 给表添加注释
COMMENT ON TABLE public.articles IS '存储文章信息的表';

-- 给字段添加注释
COMMENT ON COLUMN public.articles.article_id IS '文章的唯一标识符';

COMMENT ON COLUMN public.articles.title IS '文章的标题';

COMMENT ON COLUMN public.articles.content IS '文章的内容';

COMMENT ON COLUMN public.articles.author_id IS '文章的作者ID';

COMMENT ON COLUMN public.articles.created_at IS '文章的创建时间';

COMMENT ON COLUMN public.articles.updated_at IS '文章的更新时间';

-- 评论表，用于存储文章的评论
CREATE TABLE
    public.comments (
        comment_id SERIAL PRIMARY KEY, -- 评论ID，自增
        article_id INT REFERENCES public.articles (article_id) ON DELETE CASCADE, -- 文章ID，引用文章表
        user_id INT REFERENCES public.users (user_id) ON DELETE SET NULL, -- 评论的用户ID，引用用户表
        content TEXT NOT NULL, -- 评论内容
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 创建时间，默认当前时间
    );

-- 给表添加注释
COMMENT ON TABLE public.comments IS '存储文章评论信息的表';

-- 给字段添加注释
COMMENT ON COLUMN public.comments.comment_id IS '评论的唯一标识符';

COMMENT ON COLUMN public.comments.article_id IS '评论所属的文章ID';

COMMENT ON COLUMN public.comments.user_id IS '发表评论的用户ID';

COMMENT ON COLUMN public.comments.content IS '评论的具体内容';

COMMENT ON COLUMN public.comments.created_at IS '评论的创建时间';

-- 分类表，用于存储文章分类信息
CREATE TABLE
    public.categories (
        category_id SERIAL PRIMARY KEY, -- 分类ID，自增
        name VARCHAR(100) UNIQUE NOT NULL, -- 分类名称
        description TEXT -- 分类描述
    );

-- 给表添加注释
COMMENT ON TABLE public.categories IS '存储文章分类信息的表';

-- 给字段添加注释
COMMENT ON COLUMN public.categories.category_id IS '分类的唯一标识符';

COMMENT ON COLUMN public.categories.name IS '分类的名称';

COMMENT ON COLUMN public.categories.description IS '分类的描述';

-- 文章与分类关联表，用于支持多对多关系
CREATE TABLE
    public.article_categories (
        article_id INT REFERENCES public.articles (article_id) ON DELETE CASCADE, -- 文章ID，引用文章表
        category_id INT REFERENCES public.categories (category_id) ON DELETE CASCADE, -- 分类ID，引用分类表
        PRIMARY KEY (article_id, category_id) -- 联合主键
    );

-- 给表添加注释
COMMENT ON TABLE public.article_categories IS '文章与分类的关联表，用于支持多对多关系';

-- 文章与标签关联表，用于支持多对多关系
CREATE TABLE
    public.article_tags (
        article_id INT REFERENCES public.articles (article_id) ON DELETE CASCADE, -- 文章ID，引用文章表
        tag_id INT REFERENCES public.tags (tag_id) ON DELETE CASCADE, -- 标签ID，引用标签表
        PRIMARY KEY (article_id, tag_id) -- 联合主键
    );

-- 支付记录表，用于存储订单支付信息
CREATE TABLE
    public.payments (
        payment_id SERIAL PRIMARY KEY, -- 支付记录ID，自增
        order_id INT REFERENCES public.orders (order_id) ON DELETE CASCADE, -- 订单ID，引用订单表
        amount DECIMAL(10, 2) NOT NULL, -- 支付金额
        payment_method VARCHAR(50) NOT NULL, -- 支付方式
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 支付时间
    );

-- 给表添加注释
COMMENT ON TABLE public.payments IS '存储支付记录信息的表';

-- 给字段添加注释
COMMENT ON COLUMN public.payments.payment_id IS '支付记录的唯一标识符';

COMMENT ON COLUMN public.payments.order_id IS '关联的订单ID';

COMMENT ON COLUMN public.payments.amount IS '支付金额';

COMMENT ON COLUMN public.payments.payment_method IS '支付方式';

COMMENT ON COLUMN public.payments.payment_date IS '支付日期和时间';

-- 订单表，用于存储用户订单信息
CREATE TABLE
    public.orders (
        order_id SERIAL PRIMARY KEY, -- 订单ID，自增
        user_id INT REFERENCES public.users (user_id) ON DELETE SET NULL, -- 用户ID，引用用户表
        total_amount DECIMAL(10, 2) NOT NULL, -- 订单总金额
        status VARCHAR(50) NOT NULL, -- 订单状态
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 更新时间
    );

-- 给表添加注释
COMMENT ON TABLE public.orders IS '存储订单信息的表';

-- 给字段添加注释
COMMENT ON COLUMN public.orders.order_id IS '订单的唯一标识符';

COMMENT ON COLUMN public.orders.user_id IS '用户的唯一标识符';

COMMENT ON COLUMN public.orders.total_amount IS '订单的总金额';

COMMENT ON COLUMN public.orders.status IS '订单的状态';

COMMENT ON COLUMN public.orders.created_at IS '订单的创建时间';

COMMENT ON COLUMN public.orders.updated_at IS '订单的最后更新时间';

-- 订单项表，用于存储订单中的商品信息
CREATE TABLE
    public.order_items (
        order_item_id SERIAL PRIMARY KEY, -- 订单项ID，自增
        order_id INT REFERENCES public.orders (order_id) ON DELETE CASCADE, -- 订单ID，引用订单表
        product_name VARCHAR(255) NOT NULL, -- 商品名称
        quantity INT NOT NULL, -- 商品数量
        price DECIMAL(10, 2) NOT NULL -- 商品单价
    );

-- 给表添加注释
COMMENT ON TABLE public.order_items IS '存储订单中的商品项信息的表';

-- 给字段添加注释
COMMENT ON COLUMN public.order_items.order_item_id IS '订单项的唯一标识符';

COMMENT ON COLUMN public.order_items.order_id IS '订单ID，引用订单表';

COMMENT ON COLUMN public.order_items.product_name IS '商品的名称';

COMMENT ON COLUMN public.order_items.quantity IS '商品的数量';

COMMENT ON COLUMN public.order_items.price IS '商品的单价';