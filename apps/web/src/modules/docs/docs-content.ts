export type DocsPage = {
  category: string;
  commonMistakes: string[];
  important: string[];
  intro: string;
  related?: string[];
  slug: string;
  steps: string[];
  tips: string[];
  title: string;
  useCase: string[];
};

export type DocsSection = {
  title: string;
  pages: DocsPage[];
};

type PageInput = Omit<DocsPage, "category">;

const docsInput: Array<{ title: string; pages: PageInput[] }> = [
  {
    title: "শুরু করা",
    pages: [
      page({
        slug: "getting-started",
        title: "Dash Commerce OS কী?",
        intro:
          "Dash Commerce OS হলো বাংলাদেশের অনলাইন ব্যবসার জন্য একটি পূর্ণাঙ্গ কমার্স অপারেটিং সিস্টেম। এখানে একই জায়গা থেকে স্টোরফ্রন্ট, পণ্য, অর্ডার, কাস্টমার, পেমেন্ট, শিপিং, রিপোর্ট, স্টক, বিলিং এবং StoreOS AI Assistant পরিচালনা করা যায়।",
        useCase: [
          "Facebook/Instagram inbox নির্ভর অর্ডারকে একটি পেশাদার অনলাইন স্টোরে আনতে।",
          "পণ্য, অর্ডার, কাস্টমার, স্টক, খরচ এবং রিপোর্ট এক জায়গায় রাখতে।",
          "ম্যানুয়াল bKash, Nagad, Rocket, COD এবং ডেলিভারি রেট দিয়ে checkout চালু করতে।"
        ],
        steps: [
          "প্রথমে একটি অ্যাকাউন্ট তৈরি করুন অথবা Google দিয়ে লগইন করুন।",
          "Workspace Setup-এ আপনার স্টোরের নাম, URL, ব্যবসার ধরন, দেশ, মুদ্রা এবং টাইমজোন দিন।",
          "Dashboard থেকে General, Theme, Payments এবং Shipping সেটিংস সম্পূর্ণ করুন।",
          "Products থেকে পণ্য যোগ করুন এবং active/public করুন।",
          "স্টোরফ্রন্ট URL খুলে checkout পর্যন্ত টেস্ট করুন।"
        ],
        important: [
          "Dashboard, Admin Console এবং Storefront আলাদা অংশ। বিক্রেতারা মূলত Dashboard ব্যবহার করবেন।",
          "স্টোর তৈরি হলে প্রয়োজনীয় default settings, theme, COD payment এবং shipping rate তৈরি হওয়ার কথা।",
          "StoreOS AI Assistant কাজ করতে StoreOS connection configured থাকতে হবে।"
        ],
        tips: [
          "স্টোর লাইভ করার আগে একটি টেস্ট পণ্য, একটি টেস্ট অর্ডার এবং একটি টেস্ট manual payment flow পরীক্ষা করুন।",
          "ব্যবসার তথ্য বাংলায় বা ইংরেজিতে দিতে পারেন, তবে customer-facing কপি সহজ রাখুন।"
        ],
        commonMistakes: [
          "স্টোর তৈরি করেই পেমেন্ট ও শিপিং সেটিংস না করে checkout টেস্ট করা।",
          "Draft বা Hidden পণ্য storefront-এ দেখা যাবে মনে করা।",
          "Admin-only billing approval seller dashboard থেকে করার চেষ্টা করা।"
        ],
        related: ["অ্যাকাউন্ট তৈরি করা", "স্টোর তৈরি করা", "Dashboard Overview"]
      }),
      page({
        slug: "create-account",
        title: "অ্যাকাউন্ট তৈরি করা",
        intro:
          "Dash Commerce OS ব্যবহার শুরু করতে seller account প্রয়োজন। Registration পেজে email/password দিয়ে account তৈরি করা যায়, এবং Google authentication configured থাকলে Google দিয়েও শুরু করা যায়।",
        useCase: [
          "নতুন ব্যবসার জন্য প্রথম seller account তৈরি করতে।",
          "নিজের dashboard, store setup এবং billing access পেতে।",
          "পরবর্তীতে profile, password এবং preferences পরিচালনা করতে।"
        ],
        steps: [
          "হোমপেজ থেকে Start Free অথবা /register খুলুন।",
          "Full Name, Email এবং Password দিন।",
          "Google দিয়ে চালু করতে চাইলে Continue with Google ব্যবহার করুন।",
          "Account তৈরি হলে আপনাকে dashboard বা workspace setup flow-তে পাঠানো হবে।",
          "Profile পেজে গিয়ে নাম, avatar URL, phone, language, timezone এবং date format আপডেট করতে পারবেন।"
        ],
        important: [
          "Email unique হতে হবে। একই email দিয়ে দুইটি account তৈরি করা যাবে না।",
          "Password login ব্যবহার করলে পরবর্তীতে Profile থেকে password change করা যাবে।",
          "Google-only account হলে password change unavailable দেখাতে পারে।"
        ],
        tips: [
          "যে email-টি ব্যবসার অফিসিয়াল যোগাযোগে ব্যবহার করেন সেটি ব্যবহার করুন।",
          "Team member যোগ করার feature পরে এলে এই account store ownership-এর মূল ভিত্তি হবে।"
        ],
        commonMistakes: [
          "ভুল email দিয়ে account তৈরি করা এবং পরে verification/payment communication মিস করা।",
          "Google sign-in configured না থাকলে সেটিকে password সমস্যার সাথে গুলিয়ে ফেলা।"
        ],
        related: ["লগইন", "Profile ও Account Settings", "স্টোর তৈরি করা"]
      }),
      page({
        slug: "login",
        title: "লগইন",
        intro:
          "Login পেজ থেকে email/password অথবা Google OAuth দিয়ে dashboard-এ প্রবেশ করা যায়। সফল login-এর পর যদি store থাকে তাহলে dashboard দেখা যাবে, আর store না থাকলে onboarding flow শুরু হবে।",
        useCase: [
          "প্রতিদিনের order, product, customer এবং report দেখার জন্য dashboard খুলতে।",
          "Google-connected account দিয়ে দ্রুত sign in করতে।",
          "Logout করার পর আবার নিরাপদভাবে ফিরে আসতে।"
        ],
        steps: [
          "/login খুলুন।",
          "Email এবং Password লিখে Log In চাপুন, অথবা Continue with Google ব্যবহার করুন।",
          "Login সফল হলে Dashboard খুলবে।",
          "যদি organization/store না থাকে, তাহলে workspace setup flow দেখাবে।",
          "Topbar avatar dropdown থেকে Profile, Account Settings বা Logout ব্যবহার করুন।"
        ],
        important: [
          "Google sign-in কাজ করতে GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET এবং callback URL সঠিক থাকতে হবে।",
          "Unauthenticated user /dashboard খুললে login পেজে redirect হবে।",
          "Platform owner/admin route seller login flow থেকে আলাদা authorization ব্যবহার করে।"
        ],
        tips: [
          "Public computer থেকে কাজ করলে শেষে Logout করুন।",
          "Password ভুলে গেলে reset flow না থাকলে support-এ যোগাযোগ করুন।"
        ],
        commonMistakes: [
          "Google Console callback URL ভুল রেখে Google login test করা।",
          "Store setup না হওয়ায় dashboard না দেখে onboarding দেখলে সেটিকে login error ভাবা।"
        ],
        related: ["অ্যাকাউন্ট তৈরি করা", "স্টোর তৈরি করা", "Profile ও Account Settings"]
      }),
      page({
        slug: "create-store",
        title: "স্টোর তৈরি করা",
        intro:
          "প্রথম login-এর পরে Dash Commerce OS একটি premium multi-step workspace setup দেখায়। এখানে store name, slug/subdomain, business type, country, currency এবং timezone দিয়ে আপনার tenant store তৈরি হয়।",
        useCase: [
          "নতুন brand-এর জন্য Dash storefront তৈরি করতে।",
          "Organization, Organization Member, Store এবং Store Domain একসাথে তৈরি করতে।",
          "স্টোরের default settings, theme, payment, shipping এবং subscription foundation শুরু করতে।"
        ],
        steps: [
          "Step 1-এ Store Name লিখুন।",
          "Step 2-এ Store URL slug লিখুন, যেমন akashfashion। URL preview দেখে নিন।",
          "Step 3-এ Business Type নির্বাচন করুন।",
          "Step 4-এ Country নির্বাচন করুন। Currency এবং Timezone auto-fill হবে।",
          "Step 5-এ preview দেখে Create Workspace চাপুন।"
        ],
        important: [
          "Store slug lowercase letters, numbers এবং hyphen দিয়ে 3-40 characters হওয়া উচিত।",
          "Slug unique হতে হবে; একই slug অন্য store ব্যবহার করলে error দেখাবে।",
          "StoreDomain হিসেবে {storeSlug}.dash.com তৈরি হয়।"
        ],
        tips: [
          "Slug ছোট, সহজ এবং brand-এর সাথে মিল রেখে দিন।",
          "Store name পরে settings থেকে branding হিসেবে ঠিক করা যায়, কিন্তু slug পরিবর্তন করলে customer URL প্রভাবিত হতে পারে।"
        ],
        commonMistakes: [
          "Slug-এ space, capital letter বা special character ব্যবহার করা।",
          "Country/currency ঠিক না দেখে workspace create করা।"
        ],
        related: ["Complete Store Setup", "General Settings", "Storefront Overview"]
      }),
      page({
        slug: "complete-store-setup",
        title: "Complete Store Setup",
        intro:
          "স্টোর তৈরি করার পর dashboard ব্যবহারযোগ্য হলেও public checkout চালু করার আগে কিছু গুরুত্বপূর্ণ setup শেষ করা দরকার। General, Theme, Payment, Shipping এবং Media সেটিংস সম্পূর্ণ করলে customer experience ভালো হয়।",
        useCase: [
          "স্টোরফ্রন্টে সঠিক logo, hero, contact এবং brand color দেখাতে।",
          "Customer checkout-এ payment method ও shipping rate দেখাতে।",
          "অর্ডার, invoice এবং support information নির্ভরযোগ্য করতে।"
        ],
        steps: [
          "Settings > General থেকে logo, favicon, tagline, email, phone এবং address দিন।",
          "Settings > Theme থেকে hero title, subtitle, announcement এবং color ঠিক করুন।",
          "Settings > Payments থেকে COD, bKash, Nagad বা Rocket method enable/configure করুন।",
          "Settings > Shipping থেকে delivery zones এবং flat rates review করুন।",
          "Products থেকে active/public পণ্য যোগ করে storefront preview করুন।"
        ],
        important: [
          "Payment method disabled থাকলে checkout-এ customer সেটি দেখবে না।",
          "Shipping rate enabled না থাকলে checkout order total ঠিকভাবে তৈরি হবে না।",
          "Logo/favicon URL সরাসরি দেয়া যায় অথবা Media Library থেকে upload করা image URL ব্যবহার করা যায়।"
        ],
        tips: [
          "প্রথম launch-এর আগে নিজের phone number দিয়ে একটি test order করুন।",
          "Homepage hero image না থাকলেও default layout সুন্দর থাকে, কিন্তু brand image দিলে trust বাড়ে।"
        ],
        commonMistakes: [
          "Storefront সুন্দর করার আগে product status active/public করা ভুলে যাওয়া।",
          "Manual payment instruction না লিখে bKash/Nagad enable করা।"
        ],
        related: ["Payment Methods", "Shipping Zones", "Theme & Branding"]
      }),
      page({
        slug: "dashboard-overview",
        title: "Dashboard Overview",
        intro:
          "Dashboard overview হলো store-এর দৈনিক health check। এখানে revenue, orders, pending orders, product count, low stock, recent orders, top products এবং quick actions দেখা যায়।",
        useCase: [
          "আজকের sales এবং pending কাজ দ্রুত দেখতে।",
          "Low stock product খুঁজে stock update করতে।",
          "Add Product, View Orders, Customize Store, Open Storefront এবং AI Assistant-এ দ্রুত যেতে।"
        ],
        steps: [
          "/dashboard খুলুন।",
          "Metric cards দেখে revenue, orders এবং product অবস্থা বুঝুন।",
          "Recent Orders table থেকে নতুন order খুলুন।",
          "Low Stock section দেখে stock কম থাকা product update করুন।",
          "Quick Actions দিয়ে সবচেয়ে বেশি ব্যবহৃত কাজগুলো শুরু করুন।"
        ],
        important: [
          "Revenue সাধারণত cancelled order বাদ দিয়ে হিসাব করা হয়।",
          "Low stock দেখাতে product stockQuantity এবং lowStockThreshold দরকার।",
          "New store হলে empty states দেখা স্বাভাবিক।"
        ],
        tips: [
          "প্রতিদিন order processing শুরু করার আগে Dashboard overview দেখুন।",
          "Top Products দেখে কোন product বেশি চলছে তা বুঝে inventory পরিকল্পনা করুন।"
        ],
        commonMistakes: [
          "Draft product count দেখে live storefront product মনে করা।",
          "Pending order না দেখে stock বা shipping update করা।"
        ],
        related: ["Manage Orders", "Inventory", "Reports"]
      })
    ]
  },
  {
    title: "পণ্য",
    pages: [
      page({
        slug: "products",
        title: "Manage Products",
        intro:
          "Products page থেকে store-এর সব product দেখা, search/filter/sort করা, status পরিবর্তন করা, bulk action নেয়া এবং edit/view/archive করা যায়।",
        useCase: [
          "Live, Draft এবং Trash tab দিয়ে catalog আলাদা করতে।",
          "Category filter ও sort দিয়ে দ্রুত product খুঁজতে।",
          "Status dropdown বা bulk action দিয়ে অনেক product একসাথে Live, Draft বা Trash করতে।"
        ],
        steps: [
          "Dashboard > Products > All Products খুলুন।",
          "All, Live, Draft বা Trash tab নির্বাচন করুন।",
          "Search, Category dropdown এবং Sort ব্যবহার করে তালিকা ছোট করুন।",
          "একটি product row hover করলে Edit, Builder, View, Delete action দেখা যাবে।",
          "Bulk checkbox দিয়ে একাধিক product select করে Move to Live/Draft/Trash করুন।"
        ],
        important: [
          "Live tab আসলে ACTIVE status দেখায়। Trash tab ARCHIVED product দেখায়।",
          "Storefront-এ শুধু ACTIVE এবং PUBLIC product দেখা যায়।",
          "Delete/Trash action accidental হলে confirmation modal দেখানো হয়।"
        ],
        tips: [
          "নতুন product আগে Draft রেখে সব তথ্য ঠিক করুন, তারপর Live করুন।",
          "SKU থাকলে search-এ product খুঁজতে সহজ হয়।"
        ],
        commonMistakes: [
          "Product ACTIVE করলেও Visibility HIDDEN থাকলে storefront-এ না দেখা।",
          "Bulk action করার আগে ভুল product select করা।"
        ],
        related: ["Add Product", "Product Status", "Inventory"]
      }),
      page({
        slug: "products/add-product",
        title: "Add Product",
        intro:
          "Add Product form দিয়ে title, slug, description, SKU, price, stock, category, status, visibility এবং image URL দিয়ে নতুন product তৈরি করা যায়।",
        useCase: [
          "নতুন item catalog-এ যোগ করতে।",
          "Price, compare-at price এবং cost price track করতে।",
          "Media Library থেকে product image URL ব্যবহার করতে।"
        ],
        steps: [
          "Products > Add Product খুলুন।",
          "Title লিখলে slug auto-generate হবে; চাইলে slug edit করুন।",
          "Short description, full description, SKU এবং category দিন।",
          "Price, compare-at price, cost price, stock quantity এবং low stock threshold দিন।",
          "Status ও Visibility নির্বাচন করুন, image URLs দিন, তারপর Create product চাপুন।"
        ],
        important: [
          "Price field Decimal হিসেবে save হয়, তাই 2490 বা 2490.00 ব্যবহার করা যায়।",
          "Product slug একই store-এর ভিতরে unique হতে হবে।",
          "Image URL invalid হলে validation error দেখাবে।"
        ],
        tips: [
          "Short description customer card ও detail page-এর জন্য ছোট রাখুন।",
          "Compare-at price দিলে sale pricing বোঝাতে সুবিধা হয়।"
        ],
        commonMistakes: [
          "Stock quantity 0 রেখে product live করা।",
          "Image URL-এ file path লিখে public URL না দেয়া।"
        ],
        related: ["Media Library", "Categories", "Product Page"]
      }),
      page({
        slug: "products/edit-product",
        title: "Edit Product",
        intro:
          "Edit Product page-এ existing product-এর তথ্য update করা যায়। Title, pricing, inventory, category, images, status এবং visibility পরিবর্তন করলে storefront behavior বদলে যায়।",
        useCase: [
          "ভুল price বা stock ঠিক করতে।",
          "Product description বা image update করতে।",
          "Draft product launch করার আগে final review করতে।"
        ],
        steps: [
          "Products list থেকে product row hover করে Edit চাপুন।",
          "যে field পরিবর্তন দরকার সেটি update করুন।",
          "Status বা visibility পরিবর্তন করলে storefront-এ প্রভাব বুঝে নিন।",
          "Save product চাপুন।",
          "পাবলিক product হলে storefront product page খুলে দেখে নিন।"
        ],
        important: [
          "Tenant isolation অনুযায়ী অন্য store-এর product edit করা যাবে না।",
          "Slug পরিবর্তন করলে old product URL কাজ নাও করতে পারে।",
          "Stock history আলাদা Inventory module-এ দেখা যায়।"
        ],
        tips: [
          "SEO ও customer sharing-এর জন্য slug বারবার পরিবর্তন না করা ভালো।",
          "Price update করার আগে compare-at price পরিষ্কার করুন।"
        ],
        commonMistakes: [
          "Product edit করে Save না চাপা।",
          "Archived product edit করে storefront-এ দেখার আশা করা।"
        ],
        related: ["Manage Products", "Product Status", "Product Stock History"]
      }),
      page({
        slug: "products/status",
        title: "Product Status",
        intro:
          "Product status store catalog workflow নিয়ন্ত্রণ করে। Dash Commerce OS-এ product DRAFT, ACTIVE বা ARCHIVED হতে পারে এবং visibility PUBLIC বা HIDDEN হতে পারে।",
        useCase: [
          "অপূর্ণ product Draft রাখতে।",
          "Customer-facing product Active/Public করতে।",
          "পুরোনো product Archive বা Trash tab-এ সরাতে।"
        ],
        steps: [
          "Products table-এ product status dropdown খুলুন।",
          "Live করতে ACTIVE নির্বাচন করুন।",
          "কাজ শেষ না হলে DRAFT নির্বাচন করুন।",
          "Catalog থেকে সরাতে ARCHIVED নির্বাচন করুন।",
          "Bulk action ব্যবহার করলে selected products একই status-এ যাবে।"
        ],
        important: [
          "Storefront query শুধু ACTIVE + PUBLIC product দেখায়।",
          "Archived product public shop, search এবং category page-এ দেখা যাবে না।",
          "Status count tab refresh হলে নতুন সংখ্যা দেখাবে।"
        ],
        tips: [
          "Seasonal product off করতে Archive ব্যবহার করুন, delete না করাই নিরাপদ।",
          "Launch checklist শেষ না হলে product Draft রাখুন।"
        ],
        commonMistakes: [
          "Visibility HIDDEN রেখে status ACTIVE করা।",
          "Trash tab-কে permanent delete মনে করা।"
        ],
        related: ["Manage Products", "Storefront Overview", "Shop Page"]
      }),
      page({
        slug: "products/inventory",
        title: "Inventory",
        intro:
          "Inventory module product stock এবং stock movement history দেখায়। Purchases, Sales এবং manual adjustment থেকে stock পরিবর্তনের record তৈরি হয়।",
        useCase: [
          "Total products, low stock, out of stock এবং stock value দেখতে।",
          "Manual stock adjustment করতে।",
          "Purchase received বা Sale completed হলে stock movement track করতে।"
        ],
        steps: [
          "Dashboard > Inventory খুলুন।",
          "Summary cards দেখে stock health বুঝুন।",
          "Search, product filter, type filter বা date filter দিয়ে movement খুঁজুন।",
          "Manual adjustment page-এ product, adjustment type, quantity, reason এবং notes দিন।",
          "Product edit/details area থেকে recent stock history review করুন।"
        ],
        important: [
          "Increase, Decrease এবং Set Exact Quantity adjustment support করা হয়।",
          "Stock negative হওয়া prevent করার logic আছে, তাই decrease করার আগে বর্তমান stock দেখুন।",
          "Purchase/Sale stock update duplicate না করার জন্য processed state বিবেচনা করা হয়।"
        ],
        tips: [
          "Stock কমে গেলে low stock threshold ব্যবহার করুন।",
          "Manual adjustment reason পরিষ্কার লিখলে পরে audit সহজ হয়।"
        ],
        commonMistakes: [
          "Purchase Received না করে stock বাড়বে ভাবা।",
          "Offline sale Completed না করলে stock কমবে না।"
        ],
        related: ["Purchases", "Sales", "Product Stock History"]
      }),
      page({
        slug: "products/categories",
        title: "Categories",
        intro:
          "Categories দিয়ে product catalog সাজানো যায়। Dashboard-এর category page-এ list/table এবং create form আছে, যেখানে name, slug, description এবং parent category দেয়া যায়।",
        useCase: [
          "Shop page-এ category filter তৈরি করতে।",
          "Category/collection page-এ একই ধরনের product দেখাতে।",
          "Parent-child structure দিয়ে বড় catalog সাজাতে।"
        ],
        steps: [
          "Products > Categories খুলুন।",
          "Add New Category form-এ Name লিখুন; slug auto-generate হবে।",
          "প্রয়োজনে Slug edit করুন এবং Parent category নির্বাচন করুন।",
          "Description লিখে Create Category/Save চাপুন।",
          "Product form-এ category নির্বাচন করে product assign করুন।"
        ],
        important: [
          "Category slug একই store-এর মধ্যে unique হতে হবে।",
          "Parent dropdown category hierarchy তৈরির জন্য।",
          "Category না থাকলে storefront featured categories section hide/empty হতে পারে।"
        ],
        tips: [
          "Category নাম customer-friendly রাখুন, যেমন Shoes, Bags, Accessories।",
          "খুব বেশি nested category না করলে mobile browsing সহজ হয়।"
        ],
        commonMistakes: [
          "Category বানিয়ে product assign না করা।",
          "Slug-এ space বা বাংলা character দিয়ে URL problem তৈরি করা।"
        ],
        related: ["Add Product", "Shop Page", "Category Page"]
      }),
      page({
        slug: "products/attributes",
        title: "Attributes",
        intro:
          "Attributes page Products submenu-এর catalog organization foundation। বর্তমানে এটি dashboard UI pattern অনুযায়ী name ও slug সংরক্ষণের lightweight management screen হিসেবে ব্যবহৃত হয়।",
        useCase: [
          "Size, Color, Material-এর মতো reusable product attribute পরিকল্পনা করতে।",
          "ভবিষ্যতের advanced filter বা variant system-এর জন্য catalog structure প্রস্তুত রাখতে।",
          "Team-এর মধ্যে product data naming consistent রাখতে।"
        ],
        steps: [
          "Products > Attributes খুলুন।",
          "Name লিখুন, যেমন Color বা Size।",
          "Slug auto-generate হলে review করুন।",
          "Create Attribute চাপুন।",
          "List table থেকে edit/delete icon ব্যবহার করে item manage করুন।"
        ],
        important: [
          "বর্তমানে attributes product variant logic চালু করে না।",
          "Delete করার আগে confirmation modal দেখা উচিত।",
          "এই page category-এর মতো একই visual pattern follow করে।"
        ],
        tips: [
          "Attribute নাম ছোট রাখুন।",
          "পরে variant system এলে এই structure কাজে লাগবে, তাই duplicate নাম এড়িয়ে চলুন।"
        ],
        commonMistakes: [
          "Attribute বানালেই product page-এ automatic filter আসবে ভাবা।",
          "Brand বা Tag-এর জায়গায় Attribute ব্যবহার করা।"
        ],
        related: ["Tags", "Brands", "Add Product"]
      }),
      page({
        slug: "products/tags",
        title: "Tags",
        intro:
          "Tags product grouping-এর জন্য lightweight label foundation। Dashboard-এ Tags page category-style list এবং create form দিয়ে name/slug manage করে।",
        useCase: [
          "New Arrival, Eid Collection, Clearance-এর মতো internal grouping করতে।",
          "Marketing campaign অনুযায়ী product label plan করতে।",
          "ভবিষ্যতের filtering/search improvement-এর জন্য data প্রস্তুত রাখতে।"
        ],
        steps: [
          "Products > Tags খুলুন।",
          "Add New Tag form-এ name লিখুন।",
          "Slug ঠিক আছে কিনা দেখুন।",
          "Create Tag চাপুন।",
          "Action column থেকে edit/delete করুন।"
        ],
        important: [
          "Tags বর্তমানে checkout discount বা storefront badge চালু করে না।",
          "Slug consistent রাখলে future integrations সহজ হয়।",
          "Delete করলে confirmation popup দিয়ে accidental deletion আটকানো হয়।"
        ],
        tips: ["Season বা campaign tag আলাদা রাখুন।", "একই অর্থের অনেক tag তৈরি করবেন না।"],
        commonMistakes: [
          "Category-এর বদলে Tag দিয়ে catalog navigation আশা করা।",
          "Duplicate spelling দিয়ে একই tag বারবার বানানো।"
        ],
        related: ["Categories", "Attributes", "Manage Products"]
      }),
      page({
        slug: "products/brands",
        title: "Brands",
        intro:
          "Brands page পণ্যের manufacturer, label বা collection brand organize করার foundation। Category-style UI দিয়ে brand name এবং slug manage করা যায়।",
        useCase: [
          "Multiple brand বা supplier collection আলাদা করতে।",
          "Product details page-এ future brand information দেখানোর প্রস্তুতি নিতে।",
          "Catalog reporting বা filters-এর জন্য brand naming standard রাখতে।"
        ],
        steps: [
          "Products > Brands খুলুন।",
          "Brand name লিখুন।",
          "Slug verify করুন।",
          "Create Brand চাপুন।",
          "List থেকে edit/delete action ব্যবহার করুন।"
        ],
        important: [
          "বর্তমান product form-এ brand assignment সীমিত/placeholder হতে পারে।",
          "Brand page database schema না বাড়িয়ে dashboard UI foundation হিসেবে রাখা হয়েছে।",
          "Future-ready data রাখলেও storefront behavior যাচাই করে নিন।"
        ],
        tips: [
          "Original brand name ব্যবহার করুন।",
          "Local collection হলে brand name পরিষ্কারভাবে লিখুন, যেমন Akash Atelier।"
        ],
        commonMistakes: [
          "Supplier আর Brand একই ধরে ফেলা। Supplier purchase source, Brand customer-facing label।",
          "Brand তৈরি করেই product details page-এ দেখা যাবে ধরে নেয়া।"
        ],
        related: ["Suppliers", "Add Product", "Product Page"]
      }),
      page({
        slug: "products/reviews",
        title: "Product Reviews",
        intro:
          "Product Reviews page customer feedback management-এর UI foundation। বর্তমানে reviews schema বা submission system নেই, তাই page empty state এবং future-ready table structure দেখায়।",
        useCase: [
          "ভবিষ্যতে customer review list দেখার জায়গা হিসেবে।",
          "Product, Customer, Rating, Review, Status, Date এবং Actions column-এর structure প্রস্তুত রাখতে।",
          "Store trust ও feedback workflow পরিকল্পনা করতে।"
        ],
        steps: [
          "Products > Reviews খুলুন।",
          "Search box দিয়ে customer বা product name দিয়ে ভবিষ্যতে review খোঁজা যাবে।",
          "No Reviews Yet empty state দেখলে বুঝবেন এখনো review data নেই।",
          "Reviews চালু হলে table থেকে status/action manage করা হবে।"
        ],
        important: [
          "বর্তমানে customer storefront থেকে review submit করার feature চালু নয়।",
          "এই page dashboard design consistency বজায় রাখে।",
          "Product CRUD-এর সাথে review logic যুক্ত করা হয়নি।"
        ],
        tips: [
          "Review feature চালু হলে ভালো product photo ও description আগে ঠিক রাখুন।",
          "Support reply workflow future planning-এ রাখুন।"
        ],
        commonMistakes: [
          "Empty review page দেখে product issue মনে করা।",
          "Review collection চালু না থাকলে customer feedback automatic আসবে না।"
        ],
        related: ["Product Page", "Customers", "Manage Products"]
      })
    ]
  },
  {
    title: "অর্ডার ও কাস্টমার",
    pages: [
      page({
        slug: "orders",
        title: "Manage Orders",
        intro:
          "Orders page customer checkout থেকে তৈরি হওয়া order দেখায়। এখানে status tabs, search, date range, order table এবং order details page আছে।",
        useCase: [
          "নতুন order processing করতে।",
          "Customer, payment, shipping এবং product items একসাথে দেখতে।",
          "Order details থেকে invoice/print/download placeholder ও quick actions ব্যবহার করতে।"
        ],
        steps: [
          "Dashboard > Orders > All Orders খুলুন।",
          "All, Pending, Processing, Completed, Cancelled, On Hold, Partially Refunded বা Refunded tab ব্যবহার করুন।",
          "Search বা date range দিয়ে order খুঁজুন।",
          "Order row থেকে details খুলুন।",
          "Order Summary, Customer, Payment, Shipping, Items এবং Timeline review করুন।"
        ],
        important: [
          "Order total server-side cart, shipping এবং payment selection থেকে তৈরি হয়।",
          "Manual mobile payment হলে payment reference/order note details দেখুন।",
          "Dashboard order actions সব workflow fully automated নাও হতে পারে; status update সাবধানে করুন।"
        ],
        tips: [
          "প্রথমে Pending order দেখুন, তারপর shipping/payment verify করুন।",
          "COD order fulfillment করার আগে customer phone confirm করা ভালো।"
        ],
        commonMistakes: [
          "Payment pending থাকলেও order completed করা।",
          "Shipping amount customer input থেকে এসেছে ধরে নেয়া; সেটি server-side selected rate থেকে আসে।"
        ],
        related: ["Order Status", "Fake Order Detection", "Transactions"]
      }),
      page({
        slug: "orders/status",
        title: "Order Status",
        intro:
          "Order status business workflow বুঝতে সাহায্য করে। Dash Commerce OS order, payment, fulfillment এবং verification status আলাদা করে দেখায়।",
        useCase: [
          "Pending order থেকে processing বা completed workflow track করতে।",
          "Payment pending/paid/refunded বোঝাতে।",
          "Fulfillment status দিয়ে unfulfilled/fulfilled delivery tracking plan করতে।"
        ],
        steps: [
          "Orders list-এ status tabs দিয়ে filtered order দেখুন।",
          "Order details page খুলে Order Status, Payment Status এবং Fulfillment Status cards দেখুন।",
          "Quick action থাকলে প্রয়োজন অনুযায়ী Mark Processing, Mark Completed বা Cancel ব্যবহার করুন।",
          "Status বদলানোর আগে customer, payment এবং shipping data যাচাই করুন।"
        ],
        important: [
          "Cancelled order revenue analytics থেকে বাদ যেতে পারে।",
          "Payment Status order processing decision-এর জন্য আলাদা গুরুত্বপূর্ণ।",
          "Fulfillment Status stock বা courier integration নয়; এটি delivery progress indicator।"
        ],
        tips: [
          "Processing status ব্যবহার করে team-কে বুঝান order packing চলছে।",
          "Completed করার আগে payment এবং delivery নিশ্চিত করুন।"
        ],
        commonMistakes: [
          "Order status আর payment status একই ধরে নেয়া।",
          "Refunded payment status দেখে order automatically cancelled হবে ভাবা।"
        ],
        related: ["Manage Orders", "Transactions", "Reports"]
      }),
      page({
        slug: "orders/fake-order-detection",
        title: "Fake Order Detection",
        intro:
          "Fake Orders module rule-based risk score দিয়ে সন্দেহজনক order review করতে সাহায্য করে। Duplicate phone, cancellation history, high COD amount এবং missing information-এর মতো signal ব্যবহার করা হয়।",
        useCase: [
          "High risk COD order dispatch করার আগে যাচাই করতে।",
          "Verification Queue-তে manual review করতে।",
          "Customer flag Normal, Watchlist বা Blocked হিসেবে দেখতে।"
        ],
        steps: [
          "Orders > Fake Orders খুলুন।",
          "High, Medium, Low বা Verified tab দিয়ে risk group দেখুন।",
          "Order details খুলে risk factors, customer info এবং previous history দেখুন।",
          "Verification Queue থেকে Mark Verified, Mark Fake, Block Customer বা Return to Normal Queue action ব্যবহার করুন।"
        ],
        important: [
          "এটি AI model নয়; বর্তমানে rule-based score।",
          "Checkout flow অপরিবর্তিত রাখে; risk score order তৈরির সময় হিসাব হয়ে order-এর সাথে save থাকে।",
          "Verification Queue-তে Require verification before courier চালু করলে VERIFIED না হওয়া পর্যন্ত courier booking blocked থাকবে। Default-এ এটি বন্ধ।",
          "Action নেয়ার আগে customer phone/address manually verify করুন।"
        ],
        tips: [
          "High COD amount হলে WhatsApp/phone confirmation নিন।",
          "Repeated cancellation দেখলে delivery cost risk হিসাব করুন।"
        ],
        commonMistakes: [
          "Low risk মানেই 100% safe ধরে নেয়া।",
          "Fake mark করার আগে order details না দেখা।"
        ],
        related: ["Manage Orders", "Customers", "Abandoned Carts"]
      }),
      page({
        slug: "orders/customers",
        title: "Customers",
        intro:
          "Customers page existing orders থেকে customer summary তৈরি করে। এখানে total customers, new/returning classification, average customer value এবং customer table দেখা যায়।",
        useCase: [
          "Recurring buyer ও one-time buyer আলাদা করতে।",
          "Customer email, phone, order count, total spent এবং last order দেখতে।",
          "Customer support বা repeat marketing পরিকল্পনা করতে।"
        ],
        steps: [
          "Dashboard > Customers খুলুন।",
          "All, Recurring বা One-time tab নির্বাচন করুন।",
          "Search box দিয়ে name/email/phone খুঁজুন।",
          "KPI cards দেখে customer base বোঝুন।",
          "Table থেকে customer order history summary দেখুন।"
        ],
        important: [
          "Recurring মানে customer-এর একাধিক order আছে।",
          "One-time মানে customer-এর ঠিক এক order আছে।",
          "Customer data primarily order থেকে আসে; আলাদা customer portal পুরোপুরি চালু নয়।"
        ],
        tips: [
          "Recurring customer-দের জন্য future coupon বা campaign plan করুন।",
          "Phone/email পরিষ্কার থাকলে support সহজ হয়।"
        ],
        commonMistakes: [
          "Customer page empty হলে system broken ভাবা; order না থাকলে customer নেই।",
          "Same customer ভিন্ন phone/email দিলে separate record হতে পারে।"
        ],
        related: ["Manage Orders", "Reports", "Abandoned Carts"]
      }),
      page({
        slug: "orders/abandoned-carts",
        title: "Abandoned Carts",
        intro:
          "Abandoned Carts page operational recovery workspace। এখানে KPI cards, cart table structure, search/date filter এবং recovery action placeholders আছে। Analytics অংশ Reports > Abandoned Carts-এ রাখা হয়েছে।",
        useCase: [
          "Checkout complete না করা cart review করার জন্য foundation।",
          "Not Contacted, Contacted, Recovered status দিয়ে recovery workflow plan করতে।",
          "View Cart, Send Email, Send WhatsApp, Mark Contacted, Mark Recovered action design প্রস্তুত রাখতে।"
        ],
        steps: [
          "Dashboard > Abandoned cart খুলুন।",
          "All, Not Contacted, Contacted, Recovered বা Clean tab দেখুন।",
          "Search/date filter দিয়ে customer বা cart খুঁজুন।",
          "Record থাকলে View Cart modal/drawer থেকে product, quantity, value ও customer info দেখুন।",
          "Recovery analytics দেখতে Reports > Abandoned Carts খুলুন।"
        ],
        important: [
          "বর্তমানে full abandoned cart tracking logic future-ready foundation হিসেবে থাকতে পারে।",
          "Recovery action UI থাকলেও email/WhatsApp sending automation চালু নয়।",
          "Operational page reporting-heavy chart দেখায় না।"
        ],
        tips: [
          "High cart value হলে manual follow-up priority দিন।",
          "Recovery rate বুঝতে Reports module ব্যবহার করুন।"
        ],
        commonMistakes: [
          "Send WhatsApp button চাপলেই automatic message যাবে ধরে নেয়া।",
          "Analytics খুঁজতে operational page-এ থাকা।"
        ],
        related: ["Reports", "Customers", "Checkout"]
      }),
      page({
        slug: "orders/transactions",
        title: "Transactions",
        intro:
          "Transactions page store orders থেকে payment/refund style activity দেখায়। আলাদা transaction model না থাকলে order total থেকে simple payment rows derive করা হয়।",
        useCase: [
          "Payment, Refund এবং Adjustment tab দিয়ে আর্থিক activity দেখতে।",
          "Transaction ID, order number, customer, amount, status এবং date review করতে।",
          "Net amount ও payment/refund KPI বুঝতে।"
        ],
        steps: [
          "Dashboard > Transactions খুলুন।",
          "All, Payment, Refund বা Adjustment tab নির্বাচন করুন।",
          "Search বা date range দিয়ে record খুঁজুন।",
          "KPI cards দেখে total transactions, payments, refunds এবং net amount দেখুন।",
          "Rows না থাকলে No Transactions Found empty state দেখাবে।"
        ],
        important: [
          "Full payment gateway transaction system এখনো আলাদা নয়।",
          "Order payment status থেকে data derive হতে পারে।",
          "Refund data থাকলে refund transaction rows দেখা যায়।"
        ],
        tips: [
          "Payment reconciliation করার সময় Orders page-এর payment status মিলিয়ে দেখুন।",
          "Manual mobile payment reference Order details-এও যাচাই করুন।"
        ],
        commonMistakes: [
          "Transactions page-কে bank statement ধরে নেয়া।",
          "No transactions empty state দেখে payment settings issue ভাবা।"
        ],
        related: ["Manage Orders", "Payment Methods", "Reports"]
      })
    ]
  },
  {
    title: "ব্যবসা পরিচালনা",
    pages: [
      page({
        slug: "business/sales",
        title: "Sales",
        intro:
          "Sales module offline/manual sales record করার জন্য। Online storefront orders আলাদা Orders module-এ থাকে, আর Sales module future POS-ready manual sales foundation।",
        useCase: [
          "Showroom, phone call বা direct sale record করতে।",
          "Cash, Card, bKash, Nagad, Bank, COD বা Other payment method দিয়ে manual sale রাখতে।",
          "Completed sale হলে selected product stock কমাতে।"
        ],
        steps: [
          "Dashboard > Sales খুলুন।",
          "New Sale চাপুন।",
          "Customer optional, Sale Type, Payment Method এবং Sale Date দিন।",
          "Product add করে quantity, unit price, discount, tax, shipping এবং notes দিন।",
          "Server-side calculated subtotal, total এবং due দেখে save করুন।"
        ],
        important: [
          "Sale Status Completed হলে stock একবার decrease হয়।",
          "Draft sale stock কমায় না।",
          "Sales Returns page placeholder, return stock restore future workflow।"
        ],
        tips: [
          "Offline sale হলে notes-এ source লিখুন, যেমন showroom বা WhatsApp।",
          "Paid amount কম হলে payment status Partial/Unpaid বুঝে রাখুন।"
        ],
        commonMistakes: [
          "Online order Sales module-এ duplicate entry করা।",
          "Completed status করার আগে quantity যাচাই না করা।"
        ],
        related: ["Inventory", "Customers", "Reports"]
      }),
      page({
        slug: "business/suppliers",
        title: "Suppliers",
        intro:
          "Suppliers module purchase source বা vendor profile রাখার জায়গা। Supplier name, company, phone, email, address, notes এবং Active/Inactive status manage করা যায়।",
        useCase: [
          "যাদের কাছ থেকে product কিনেন তাদের contact data রাখতে।",
          "Purchases form-এ supplier select করতে।",
          "Supplier details page-এ purchases, due amount এবং recent activity placeholder structure দেখতে।"
        ],
        steps: [
          "Dashboard > Suppliers খুলুন।",
          "Add Supplier চাপুন।",
          "Name এবং Phone অবশ্যই দিন; company, email, address, notes optional।",
          "Status Active বা Inactive নির্বাচন করুন।",
          "Save করলে supplier list/details page-এ দেখা যাবে।"
        ],
        important: [
          "Supplier data organization/store scoped।",
          "Delete action confirmation modal দিয়ে accidental deletion আটকায়।",
          "Supplier payments/ledger এখনো built নয়।"
        ],
        tips: [
          "Supplier phone ও company name পরিষ্কার রাখলে purchase entry দ্রুত হয়।",
          "Inactive status ব্যবহার করে পুরোনো supplier list থেকে আলাদা রাখুন।"
        ],
        commonMistakes: [
          "Supplier আর customer data এক জায়গায় রাখার চেষ্টা করা।",
          "Purchase করার আগে supplier তৈরি না করা।"
        ],
        related: ["Purchases", "Expenses", "Inventory"]
      }),
      page({
        slug: "business/purchases",
        title: "Purchases",
        intro:
          "Purchases module supplier থেকে stock কেনার record রাখে। Purchase status Draft, Ordered, Received বা Cancelled হতে পারে। Received হলে selected product stock বাড়ে।",
        useCase: [
          "Supplier invoice বা purchase receipt record করতে।",
          "Manual product name বা existing product select করে purchase item রাখতে।",
          "Subtotal, discount, tax, paid, due এবং notes track করতে।"
        ],
        steps: [
          "Dashboard > Purchases খুলুন।",
          "Add Purchase চাপুন এবং Supplier নির্বাচন করুন।",
          "Purchase Date ও Status দিন।",
          "Item যোগ করুন: product select বা manual name, SKU, quantity এবং unit cost দিন।",
          "Discount, tax, paid amount ও notes দিয়ে Save Purchase করুন।"
        ],
        important: [
          "Draft বা Ordered status stock বাড়ায় না।",
          "Received status product stock বাড়ায় এবং StockMovement তৈরি করে।",
          "একই purchase বারবার received করলে duplicate stock increase prevent করা হয়।"
        ],
        tips: [
          "Supplier invoice number থাকলে notes-এ লিখুন।",
          "Paid amount কম হলে due amount দেখে পরবর্তী payment plan করুন।"
        ],
        commonMistakes: [
          "Purchase save করলেই stock বাড়বে ভাবা; Received করতে হবে।",
          "Manual item দিলে product stock update হবে না যদি product select না থাকে।"
        ],
        related: ["Suppliers", "Inventory", "Expenses"]
      }),
      page({
        slug: "business/expenses",
        title: "Expenses",
        intro:
          "Expenses module ব্যবসার খরচ record করার জন্য। Marketing, Courier, Packaging, Salary, Office Rent, Internet, Utilities, Software & Tools, Travel এবং Miscellaneous default categories থাকে।",
        useCase: [
          "Paid, Pending বা Cancelled expense track করতে।",
          "Cash, Bank, bKash, Nagad, Card বা Other payment method দিয়ে খরচ লিখতে।",
          "Monthly expense এবং pending expense KPI দেখতে।"
        ],
        steps: [
          "Dashboard > Expenses খুলুন।",
          "Add Expense চাপুন।",
          "Title, Category, Amount, Payment Method, Expense Date এবং Status দিন।",
          "Reference, Notes এবং attachment URL থাকলে দিন।",
          "Expense save করে list/filter/KPI review করুন।"
        ],
        important: [
          "Expense amount Decimal হিসেবে save হয়।",
          "Category delete করতে গেলে category ব্যবহৃত হলে prevent করা হয়।",
          "Attachment upload system available থাকলে URL ব্যবহার করা যায়; full accounting ledger নয়।"
        ],
        tips: [
          "Courier ও Packaging খরচ আলাদা category-তে রাখলে profit বুঝতে সুবিধা হয়।",
          "Pending expense নিয়মিত follow-up করুন।"
        ],
        commonMistakes: [
          "Purchase cost এবং Expense একই জায়গায় duplicate করা।",
          "Cancelled expense total expense হিসেবে ধরে নেয়া।"
        ],
        related: ["Purchases", "Reports", "Billing History"]
      }),
      page({
        slug: "business/coupons",
        title: "Coupons",
        intro:
          "Coupons module discount setup UI foundation। Coupons list, status tabs, create coupon page, discount type options এবং conditions form তৈরি আছে, তবে checkout discount application fully connected নয়।",
        useCase: [
          "Percentage, Fixed Cart, Free Products বা Free Shipping offer plan করতে।",
          "Coupon name, code, amount, product condition, minimum/maximum spend এবং date range UI প্রস্তুত রাখতে।",
          "Marketing campaign-এর discount setup flow design করতে।"
        ],
        steps: [
          "Dashboard > Coupons খুলুন।",
          "+ Create Coupon বা Add Coupon চাপুন।",
          "General card-এ Name এবং Code লিখুন।",
          "Offers card-এ Discount Type নির্বাচন করে amount/quantity field পূরণ করুন।",
          "Conditions card-এ product search, spend limits এবং start/end date দিন।"
        ],
        important: [
          "Form UI usable হলেও live checkout discount enforcement না থাকলে coupon customer order total কমাবে না।",
          "Free Shipping type হলে amount field disabled/hidden হতে পারে।",
          "Status Active/Inactive UI future-ready।"
        ],
        tips: [
          "Coupon code ছোট ও memorable রাখুন।",
          "Minimum spend দিলে campaign profitability ভালো থাকে।"
        ],
        commonMistakes: [
          "Coupon তৈরি করলেই checkout automatically discount দেবে মনে করা।",
          "Date range না দিয়ে campaign control হারানো।"
        ],
        related: ["Marketing / Analytics", "Checkout", "Reports"]
      }),
      page({
        slug: "business/reports",
        title: "Reports",
        intro:
          "Reports module store performance বুঝতে সাহায্য করে। Overview ছাড়াও Orders, Revenues, Products, Customers এবং Abandoned Carts report pages আছে।",
        useCase: [
          "Order count, revenue, refunds, net revenue, products sold এবং customer metrics দেখতে।",
          "Top selling products, low stock, category/product performance বুঝতে।",
          "Abandoned cart recovery analytics operational page থেকে আলাদা রাখতে।"
        ],
        steps: [
          "Dashboard > Reports খুলুন।",
          "Overview থেকে বড় picture দেখুন।",
          "Orders/Revenues/Products/Customers submenu থেকে specific report খুলুন।",
          "Date range controls ব্যবহার করে period পরিবর্তন করুন।",
          "Empty state দেখলে বুঝবেন ঐ period-এ data নেই।"
        ],
        important: [
          "Reports Dash database data ব্যবহার করে, StoreOS AI call করে না।",
          "Revenue সাধারণত non-cancelled order থেকে হিসাব হয়।",
          "Charts data না থাকলে professional placeholder দেখায়।"
        ],
        tips: [
          "প্রতিমাসে Revenues এবং Expenses পাশাপাশি review করুন।",
          "Low stock report দেখে purchase plan করুন।"
        ],
        commonMistakes: [
          "Reports figure আর bank received amount এক ধরে নেয়া।",
          "Cancelled/refunded order না বুঝে revenue compare করা।"
        ],
        related: ["Dashboard Overview", "Transactions", "Abandoned Carts"]
      })
    ]
  },
  {
    title: "সেটিংস",
    pages: [
      page({
        slug: "settings/general",
        title: "General Settings",
        intro:
          "General Settings হলো store-level মূল তথ্যের জায়গা। Store logo, favicon, tagline, email, phone, support phone, address, currency, language এবং timezone এখানে দেখা বা আপডেট করা যায়।",
        useCase: [
          "Header, footer, checkout এবং invoice-এ store branding দেখাতে।",
          "Customer contact information ঠিক রাখতে।",
          "Store tagline homepage hero fallback ও SEO meta description fallback হিসেবে ব্যবহার করতে।"
        ],
        steps: [
          "Settings > General খুলুন।",
          "Store Logo এবং Favicon upload করুন অথবা Media Library থেকে URL দিন।",
          "Store Tagline লিখুন।",
          "Store Email, Phone, Support Phone এবং Business Address আপডেট করুন।",
          "Save Settings চাপুন।"
        ],
        important: [
          "Store Name, URL, Currency, Language এবং Timezone readonly/controlled হতে পারে।",
          "Logo/Favicon public image URL হওয়া দরকার।",
          "Save করলে storefront header/footer/checkout/invoice integration ব্যবহার করবে।"
        ],
        tips: [
          "Logo transparent PNG/WebP ব্যবহার করলে header সুন্দর দেখায়।",
          "Tagline ১ লাইনে business promise বললে ভালো।"
        ],
        commonMistakes: [
          "Local computer path image URL হিসেবে দেয়া।",
          "Business address ফাঁকা রেখে invoice/contact trust কমানো।"
        ],
        related: ["Media Library", "Theme & Branding", "Invoice Settings"]
      }),
      page({
        slug: "settings/theme-and-branding",
        title: "Theme & Branding",
        intro:
          "Theme settings storefront-এর visual identity নিয়ন্ত্রণ করে। Default Theme currently active; seller primary color, secondary color, hero copy, hero image, announcement এবং featured section title সেট করতে পারে।",
        useCase: [
          "Storefront homepage premium এবং brand-consistent করতে।",
          "Hero title/subtitle দিয়ে customer-কে প্রথম impression দিতে।",
          "Announcement bar দিয়ে offer বা update দেখাতে।"
        ],
        steps: [
          "Settings > Theme খুলুন।",
          "Theme name readonly থাকবে।",
          "Primary Color ও Secondary Color দিন।",
          "Hero Title, Hero Subtitle এবং Hero Image URL দিন।",
          "Announcement Text ও Featured Section Title দিয়ে Save Theme চাপুন।"
        ],
        important: [
          "Theme color CSS variables storefront-only apply হয়, dashboard/admin প্রভাবিত হয় না।",
          "Invalid hex color দিলে validation error হতে পারে।",
          "Hero image না থাকলে fallback layout ব্যবহার হয়।"
        ],
        tips: [
          "Primary color খুব উজ্জ্বল হলে button text readability দেখে নিন।",
          "Announcement ছোট রাখুন, যেমন Free delivery inside Dhaka today।"
        ],
        commonMistakes: [
          "Hero title খুব বড় করে mobile layout ভেঙে ফেলা।",
          "Dashboard design বদলাবে ভেবে theme color পরিবর্তন করা।"
        ],
        related: ["General Settings", "Storefront Overview", "Homepage"]
      }),
      page({
        slug: "settings/logo-and-favicon",
        title: "Logo and Favicon",
        intro:
          "Logo storefront header/footer/checkout/invoice-এ brand identity দেখায়, আর favicon browser tab-এ ছোট icon হিসেবে দেখা যায়।",
        useCase: [
          "Customer trust বাড়াতে professional logo দেখাতে।",
          "Browser tab-এ store চিনতে favicon ব্যবহার করতে।",
          "Invoice এবং checkout-এ একই branding রাখতে।"
        ],
        steps: [
          "Media page থেকে logo/favicon image upload করুন।",
          "Copy URL ব্যবহার করে image URL নিন।",
          "Settings > General বা Theme branding area-এ URL বসান।",
          "Save Settings চাপুন।",
          "Storefront এবং browser tab refresh করে ফলাফল দেখুন।"
        ],
        important: [
          "SVG logo/favicon safe হলে allow করা হতে পারে, তবে image type validation আছে।",
          "Logo max 6MB (server-এ 512x512 WebP-তে convert হয়), favicon max 512KB এবং যে format দিবেন সেটাই থাকবে।",
          "Favicon ছোট square image হলে ভালো দেখায়।"
        ],
        tips: [
          "Logo horizontal version header-এর জন্য ভালো।",
          "Favicon 512x512 বা square icon রাখুন।"
        ],
        commonMistakes: [
          "বড় hero banner logo field-এ upload করা।",
          "Private Google Drive link image URL হিসেবে দেয়া।"
        ],
        related: ["Media Library", "General Settings", "Theme & Branding"]
      }),
      page({
        slug: "settings/storefront",
        title: "Storefront Setup",
        intro:
          "Storefront হলো customer-facing public store। Dash supports /s/{storeSlug} local route এবং wildcard subdomain foundation যেমন {storeSlug}.dash.com।",
        useCase: [
          "Customer-কে professional shop, product, cart এবং checkout experience দিতে।",
          "Store settings ও theme settings public storefront-এ apply করতে।",
          "Active/public products দিয়ে catalog চালাতে।"
        ],
        steps: [
          "Store slug নিশ্চিত করুন।",
          "/s/{storeSlug} খুলে homepage দেখুন।",
          "/s/{storeSlug}/products থেকে shop page দেখুন।",
          "Product details, cart এবং checkout flow test করুন।",
          "Header/footer-এ logo, contact এবং social links ঠিক আছে কিনা দেখুন।"
        ],
        important: [
          "Storefront route seller dashboard থেকে আলাদা layout ব্যবহার করে।",
          "Draft/hidden/archived product public storefront-এ দেখা যায় না।",
          "Custom domain future-ready; current resolver existing tenant logic ব্যবহার করে।"
        ],
        tips: [
          "প্রতিটি settings update-এর পরে incognito/mobile view দিয়ে storefront check করুন।",
          "Shop page empty হলে আগে product status/visibility দেখুন।"
        ],
        commonMistakes: [
          "Dashboard URL customer-কে পাঠানো।",
          "Localhost wildcard subdomain কাজ না করলে /s/{slug} fallback ব্যবহার না করা।"
        ],
        related: ["Shop Page", "Checkout", "Theme & Branding"]
      }),
      page({
        slug: "settings/custom-domain",
        title: "Custom Domain",
        intro:
          "Custom Domain support future-ready architecture হিসেবে রাখা হয়েছে। Storefront resolver future custom domain support করতে প্রস্তুত, তবে seller UI/configuration fully live নাও থাকতে পারে।",
        useCase: [
          "নিজস্ব domain যেমন yourbrand.com storefront-এ connect করার জন্য future planning।",
          "Brand trust বাড়াতে dash.com subdomain-এর বাইরে custom address ব্যবহার করতে।",
          "DNS ও domain verification workflow প্রস্তুত রাখতে।"
        ],
        steps: [
          "বর্তমানে store slug/subdomain দিয়ে storefront চালান।",
          "Custom domain feature enabled হলে settings area থেকে domain add করবেন।",
          "DNS instruction অনুযায়ী CNAME/A record বসাতে হবে।",
          "Verification complete হলে domain storefront resolver-এ যুক্ত হবে।"
        ],
        important: [
          "এই feature এখন foundation পর্যায়ে থাকলে live DNS connect করবেন না।",
          "Domain ownership verification ছাড়া custom domain ব্যবহার করা উচিত নয়।",
          "SSL/certificate handling future production setup-এর অংশ।"
        ],
        tips: [
          "Brand domain কেনার আগে spelling short রাখুন।",
          "Fallback dash.com subdomain সবসময় ধরে রাখুন।"
        ],
        commonMistakes: [
          "DNS record বসালেই dashboard সেটিং ছাড়া domain কাজ করবে ভাবা।",
          "Custom domain না থাকলে storefront unavailable মনে করা।"
        ],
        related: ["Storefront Setup", "General Settings", "Billing & Subscription"]
      }),
      page({
        slug: "settings/social-links",
        title: "Social Settings",
        intro:
          "Social Settings page social login credentials এবং social profile links রাখার জন্য। Facebook/Google OAuth fields, redirect URL এবং Facebook, Instagram, X/Twitter, YouTube, TikTok, LinkedIn, WhatsApp fields আছে।",
        useCase: [
          "ভবিষ্যতে social login provider configure করার credential structure রাখতে।",
          "Storefront footer/contact area-এ social profile links দেখাতে।",
          "WhatsApp number customer support বা social commerce যোগাযোগের জন্য রাখতে।"
        ],
        steps: [
          "Settings > Social খুলুন।",
          "Facebook বা Google login enable toggle থাকলে ব্যবহার করুন।",
          "App ID/Client ID এবং secret fields পূরণ করুন; redirect URL readonly field থেকে copy করুন।",
          "Social Profiles card-এ page/profile URLs দিন।",
          "Save Settings চাপুন।"
        ],
        important: [
          "OAuth login implementation seller storefront login থেকে আলাদা হতে পারে; dashboard auth flow আলাদা।",
          "Secret fields browser client-side expose করা উচিত নয়।",
          "Invalid URL হলে inline validation error দেখাতে পারে।"
        ],
        tips: [
          "WhatsApp number international formatে রাখুন, যেমন +8801XXXXXXXXX।",
          "Social links public হলে spelling ও profile access পরীক্ষা করুন।"
        ],
        commonMistakes: [
          "Facebook App Secret public note field-এ লেখা।",
          "Redirect URL নিজের মতো edit করা।"
        ],
        related: ["General Settings", "Storefront Footer", "Marketing / Analytics"]
      }),
      page({
        slug: "settings/marketing-tracking",
        title: "Marketing / Analytics",
        intro:
          "Marketing / Analytics page platform গুলোকে ID দিয়ে connect করার UI — Google (GA4, GTM, Verification), Meta (Pixel, Conversions API, Domain Verification), TikTok Pixel এবং Google Ads Conversion ID। Script tag paste করতে হয় না; আমরা প্রতিটি platform-এর official snippet generate করি।",
        useCase: [
          "GA4/GTM বা Meta Pixel শুধু ID দিয়ে connect করতে।",
          "Domain verification-এর content value রাখতে।",
          "Meta Conversions API-এর server-side token নিরাপদে রাখতে।",
          "GA4-তে server-side purchase পাঠাতে (Measurement Protocol)।"
        ],
        steps: [
          "Settings > Marketing খুলুন।",
          "Google card-এ GA4 Measurement ID (G-...) ও GTM Container ID (GTM-...) দিন।",
          "GA4-তে server-side tracking লাগলে toggle on করে Measurement Protocol API secret দিন (GA4 Admin > Data streams > আপনার stream > Measurement Protocol API secrets)।",
          "Meta card-এ Pixel ID দিন; Conversions API লাগলে toggle on করে access token দিন।",
          "TikTok Pixel ID এবং Google Ads Conversion ID (AW-...) দিন।",
          "প্রয়োজন হলে Custom Tracking enable করে header/body/footer code দিন।",
          "Save Marketing Settings চাপুন।"
        ],
        important: [
          "শুধু store owner বা admin এই settings change করতে পারেন; অন্যরা দেখতে পারেন।",
          "Conversions API token ও GA4 API secret encrypt করে রাখা হয়, browser-এ কখনও যায় না — শুধু শেষ চারটি character দেখা যায়।",
          "Server-side purchase order confirm হওয়ার পরে যায়; কোনো কারণে fail করলেও checkout-এ কোনো প্রভাব পড়ে না, শুধু activity log-এ record হয়।",
          "Custom Tracking-এ শুধু tracking tag এবং পরিচিত analytics host allow করা হয়; বাকিটা save-এর সময় reject হয়।",
          "প্রতিটি change activity log-এ কে করেছে সহ record হয়।",
          "Storefront-এ tag শুধু আপনার store-এ load হয়, dashboard-এ নয় — নিজের admin activity track হবে না।"
        ],
        tips: [
          "পুরো meta tag paste করলেও চলবে — আমরা content value বের করে নিই।",
          "GTM-এর ভিতরে GA4 থাকলে দুই জায়গায় একই ID দেবেন না, event duplicate হবে।"
        ],
        commonMistakes: [
          "ID-এর জায়গায় পুরো <script> tag paste করা।",
          "Conversions API token কে Pixel ID-এর ঘরে দেয়া — ওটা secret, আলাদা field।"
        ],
        related: ["Social Settings", "Storefront Setup", "Reports"]
      }),
      page({
        slug: "payments-delivery/courier-setup",
        title: "Courier Setup",
        intro:
          "Courier Settings page এ Steadfast বা Pathao connect করলে order থেকেই real parcel book করা যায়। RedX, Paperfly এবং Carry Bee এখনো Coming soon — ওগুলো credential নেয় না। Credential encrypt হয়ে save হয়, আর কখনওই ফেরত দেখানো হয় না — শুধু শেষ চার character।",
        useCase: [
          "Order page থেকে এক ক্লিকে courier-এ parcel book করতে।",
          "Orders list থেকে একসাথে অনেক order bulk send করতে।",
          "Delivery status auto-sync (webhook) চালু করতে।"
        ],
        steps: [
          "Settings > Courier খুলুন।",
          "Steadfast বা Pathao card-এ API credential গুলো দিন।",
          "Test connection চেপে নিশ্চিত হন credential কাজ করছে।",
          "Enable toggle চালু করুন, একাধিক courier থাকলে একটিকে Default করুন।",
          "Delivery auto-sync section-এ Generate webhook URL চাপুন, তারপর URL ও Secret courier-এর panel-এ paste করুন।"
        ],
        important: [
          "COURIER_CREDENTIALS_KEY root .env-এ না থাকলে credential save করা যাবে না।",
          "Courier API একটি paid feature — plan-এ না থাকলে booking ও tracking action গুলো blocked থাকবে।",
          "Timeout হলে কখনওই আবার send করবেন না — Refresh status দিয়ে দেখুন parcel তৈরি হয়েছে কি না।",
          "Checkout shipping amount Shipping settings থেকে আসে, courier credentials থেকে নয়।"
        ],
        tips: [
          "Provider sandbox/live credential আলাদা করে নোট রাখুন।",
          "Webhook চালু থাকলে Orders list-এর Delivery column নিজে নিজেই update হয়।"
        ],
        commonMistakes: [
          "Webhook URL-কেই secret ভেবে courier panel-এর secret ঘরে বসানো — দুটো আলাদা মান, আলাদা ঘরে যায়।",
          "Wrong base URL দিয়ে credential save করা।"
        ],
        related: ["Order Tracking", "Shipping Zones", "Manage Orders", "Invoice Settings"]
      }),
      page({
        slug: "payments-delivery/order-tracking",
        title: "Order Tracking",
        intro:
          "Orders > Order Tracking page-এ tracking code দিয়ে যেকোনো parcel খুঁজে তার পুরো delivery history দেখা যায়। Webhook চালু থাকলে courier নিজে থেকেই update পাঠায়, তাই status নিজে নিজেই বদলায়।",
        useCase: [
          "Customer ফোন করে জানতে চাইলে সাথে সাথে parcel কোথায় আছে বলতে।",
          "একটি order-এর ভেতরেই Order Tracking panel-এ শেষ অবস্থা দেখতে।",
          "Orders list-এর Delivery column-এ সব parcel-এর অবস্থা একসাথে দেখতে।"
        ],
        steps: [
          "Orders > Order Tracking খুলুন।",
          "Tracking code, consignment id, invoice reference বা order number — যেকোনো একটি লিখে Track চাপুন।",
          "Delivery history-তে প্রতিটি update কখন ও কোথা থেকে এসেছে দেখুন।",
          "Auto-sync বন্ধ থাকলে Refresh চেপে courier থেকে সরাসরি status আনুন।",
          "Open order চেপে সেই order-এর detail page-এ যান।"
        ],
        important: [
          "Order Tracking একটি paid feature — Starter plan থেকে চালু।",
          "Courier যে status পাঠায় সেটাই হুবহু দেখানো হয়, আমরা বদলাই না।",
          "শুধু নিশ্চিত delivered হলেই order FULFILLED হয়; delivered_approval_pending হলে হয় না।",
          "Auto-sync off থাকলে status শুধু Refresh চাপলে বদলাবে।"
        ],
        tips: [
          "Customer-এর কাছ থেকে order number নিলেই হবে — tracking code মুখস্থ করার দরকার নেই।",
          "Recent parcels list থেকে সরাসরি click করে track করা যায়।"
        ],
        commonMistakes: [
          "Webhook setup না করে status নিজে নিজে update হবে আশা করা।",
          "Courier panel-এ webhook URL বদলে গেলে (Regenerate করার পর) পুরোনো URL রেখে দেয়া।"
        ],
        related: ["Courier Setup", "Manage Orders", "Thank You Page"]
      }),
      page({
        slug: "payments-delivery/invoice-settings",
        title: "Invoice Settings",
        intro:
          "Invoice Settings page invoice information, numbering, branding, tax/VAT এবং display options configure করার জন্য। PDF generation এখনো built নয়, কিন্তু invoice data structure প্রস্তুত।",
        useCase: [
          "Company/store name, address, phone, email, website invoice-এ রাখতে।",
          "Invoice prefix ও starting number দিয়ে format preview দেখতে।",
          "Logo, footer note, thank you message এবং tax breakdown option রাখতে।"
        ],
        steps: [
          "Settings > Invoice খুলুন।",
          "Invoice Information card-এ company/store data দিন।",
          "Invoice Address Details rich text editor-এ address লিখুন।",
          "Invoice Numbering card-এ prefix ও starting number দিন।",
          "Tax/VAT এবং Invoice Options toggles set করে Save Invoice Settings চাপুন।"
        ],
        important: [
          "Invoice number format preview readonly।",
          "Tax/VAT calculation checkout tax system নয়; invoice display setting হিসেবে প্রস্তুত।",
          "PDF invoice branding future feature।"
        ],
        tips: [
          "Invoice prefix ছোট রাখুন, যেমন INV।",
          "Footer note-এ return policy বা support contact সংক্ষেপে দিন।"
        ],
        commonMistakes: [
          "Starting invoice number বারবার বদলে duplicate numbering তৈরি করা।",
          "VAT number না থাকলে fake value দেয়া।"
        ],
        related: ["General Settings", "Billing Invoices", "Manage Orders"]
      }),
      page({
        slug: "payments-delivery/payment-methods",
        title: "Payment Methods",
        intro:
          "Payment settings checkout-এ customer কোন পদ্ধতিতে pay করবে তা নিয়ন্ত্রণ করে। COD, manual bKash, manual Nagad, manual Rocket support আছে।",
        useCase: [
          "Cash on Delivery enable/disable করতে।",
          "bKash/Nagad/Rocket account number, account type এবং instruction দেখাতে।",
          "Checkout-এ শুধু enabled methods দেখাতে।"
        ],
        steps: [
          "Settings > Payments খুলুন।",
          "COD, bKash, Nagad বা Rocket method enable করুন।",
          "Display Name, Account Number, Account Type এবং Instructions দিন।",
          "Save Payment Settings চাপুন।",
          "Checkout page test করে enabled payment methods দেখুন।"
        ],
        important: [
          "Manual mobile payment মানে customer নিজে pay করে transaction ID দেবে।",
          "Payment status default Pending থাকে যতক্ষণ seller/admin manually confirm না করে।",
          "Disabled payment method checkout-এ দেখা যায় না।"
        ],
        tips: [
          "Instructions-এ payment করার ধাপ পরিষ্কার লিখুন।",
          "COD enabled রাখলে fake order risk review করুন।"
        ],
        commonMistakes: [
          "Account number না দিয়ে bKash enable করা।",
          "Manual payment reference checkout-এ optional ভেবে রাখা; mobile payments-এ এটি দরকার।"
        ],
        related: ["Checkout", "Transactions", "Fake Order Detection"]
      }),
      page({
        slug: "payments-delivery/manual-mobile-payments",
        title: "Manual bKash/Nagad/Rocket Payments",
        intro:
          "Manual mobile payment flow-তে seller number/instruction দেখায়, customer বাইরে থেকে pay করে transaction ID, reference এবং note দিয়ে order place করে।",
        useCase: [
          "bKash/Nagad/Rocket gateway API ছাড়াই payment নিতে।",
          "Bangladesh-first checkout চালাতে।",
          "Order details-এ payment method snapshot এবং reference রাখতে।"
        ],
        steps: [
          "Settings > Payments থেকে mobile method enable করুন।",
          "Account number, account type এবং instruction দিন।",
          "Customer checkout-এ ঐ method select করবে।",
          "Customer transaction/reference ID এবং optional note দেবে।",
          "Order details থেকে reference verify করে payment confirm করুন।"
        ],
        important: [
          "System client amount trust করে না; order total server-side calculate হয়।",
          "Manual payment auto-verified নয়।",
          "Payment method name/type order creation সময় snapshot হয়।"
        ],
        tips: [
          "Payment note-এ customer phone mismatch হলে manually check করুন।",
          "Transaction ID clear না হলে customer support call করুন।"
        ],
        commonMistakes: [
          "Manual payment received হলেই Payment Status automatically Paid হবে ভাবা।",
          "Wrong account number instruction-এ রেখে order নেওয়া।"
        ],
        related: ["Payment Methods", "Checkout", "Manage Orders"]
      }),
      page({
        slug: "payments-delivery/shipping-zones",
        title: "Shipping Zones",
        intro:
          "Shipping settings Bangladesh-first delivery zones ও flat rates manage করে। Default Inside Dhaka এবং Outside Dhaka zones/rates তৈরি হতে পারে।",
        useCase: [
          "Checkout-এ delivery method/rate দেখাতে।",
          "District, city, area match fields দিয়ে flat rate organize করতে।",
          "Shipping amount order total-এ server-side যোগ করতে।"
        ],
        steps: [
          "Settings > Shipping খুলুন।",
          "Zones enable/disable করুন।",
          "Existing rates edit করুন বা Add delivery rate form ব্যবহার করুন।",
          "Rate name, zone, district/city/area, amount এবং enabled state দিন।",
          "Save Shipping Settings চাপুন।"
        ],
        important: [
          "Shipping amount checkout submission থেকে trust করা হয় না; database rate থেকে calculate হয়।",
          "Disabled zone/rate customer checkout-এ দেখা যায় না।",
          "Amount Decimal হিসেবে save হয়।"
        ],
        tips: [
          "Inside Dhaka ও Outside Dhaka rate আলাদা রাখুন।",
          "Area-specific rate দরকার না হলে district/city/area ফাঁকা রাখতে পারেন।"
        ],
        commonMistakes: [
          "Rate enabled না করে checkout test করা।",
          "Shipping amount client-side input হিসেবে ধরে নেয়া।"
        ],
        related: ["Checkout", "Courier Setup", "Manage Orders"]
      }),
      page({
        slug: "settings/media",
        title: "Media Library",
        intro:
          "Media Library store-scoped image upload এবং URL reuse করার জায়গা। Logo, favicon, hero image এবং product images এখানে upload করে URL copy করা যায়।",
        useCase: [
          "Product image URL field পূরণ করতে।",
          "General/Theme settings-এ logo বা hero image ব্যবহার করতে।",
          "Uploaded asset list, usage type, size এবং delete action manage করতে।"
        ],
        steps: [
          "Settings > Media খুলুন।",
          "Upload form থেকে image file নির্বাচন করুন।",
          "Usage type নির্বাচন করুন এবং alt text দিন।",
          "Upload image চাপুন।",
          "Media card থেকে Copy URL নিয়ে product/settings form-এ ব্যবহার করুন।"
        ],
        important: [
          "Upload হওয়া image server-এ নিজে থেকেই resize হয়ে WebP-তে convert হয় — product 1200x1200 px, category 1200x900, hero 1920x1080, logo 512x512।",
          "Upload limit: image প্রতি 6MB, favicon 512KB (favicon convert হয় না, যেমন আছে তেমনই থাকে)।",
          "Local development storage এবং production S3/R2-compatible placeholder architecture আছে।",
          "Media asset store-scoped; অন্য tenant-এর media দেখা যাবে না।"
        ],
        tips: [
          "Product card image square বা 4:5 aspect রাখলে grid সুন্দর হয়।",
          "Alt text দিলে accessibility এবং SEO ভালো হয়।"
        ],
        commonMistakes: [
          "Delete করলে যেসব form-এ URL ব্যবহার হয়েছে সেগুলো broken image দেখাতে পারে।",
          "PDF বা non-image upload করার চেষ্টা করা।"
        ],
        related: ["Add Product", "Logo and Favicon", "Theme & Branding"]
      }),
      page({
        slug: "settings/storeos-ai",
        title: "StoreOS AI",
        intro:
          "StoreOS AI Assistant Dash dashboard-এর মধ্যে chat interface দিয়ে business প্রশ্নের উত্তর দেয়। StoreOS API configured না থাকলে clear fallback message দেখায়।",
        useCase: [
          "আজ কত order, এই মাসে sales, low stock product বা best-selling product দ্রুত জিজ্ঞেস করতে।",
          "StoreOS native connection status দেখতে।",
          "Connect/reconnect action দিয়ে connection retry করতে।"
        ],
        steps: [
          "Settings > StoreOS / AI বা Dashboard > AI Assistant খুলুন।",
          "Connection panel থেকে API configured, status, connection ID এবং last synced দেখুন।",
          "Suggested prompts থেকে প্রশ্ন select করুন অথবা নিজের প্রশ্ন লিখুন।",
          "Send চাপুন।",
          "Not configured message এলে StoreOS API setup দরকার।"
        ],
        important: [
          "STOREOS_API_KEY browser-এ expose করা হয় না।",
          "AI chat backend current user/store verify করে।",
          "Autonomous AI actions এখনো চালু নয়।"
        ],
        tips: [
          "প্রশ্ন নির্দিষ্ট করুন, যেমন আজ কত pending order আছে।",
          "Critical business decision নেয়ার আগে Reports/Orders data মিলিয়ে দেখুন।"
        ],
        commonMistakes: [
          "StoreOS not configured হলে AI broken মনে করা।",
          "AI answer-কে accounting final report ধরে নেয়া।"
        ],
        related: ["Reports", "Dashboard Overview", "StoreOS AI Overview"]
      })
    ]
  },
  {
    title: "বিলিং ও সাবস্ক্রিপশন",
    pages: [
      page({
        slug: "billing",
        title: "Current Plan",
        intro:
          "Billing page seller subscription, plan, usage, manual payment submission, billing history এবং invoice records দেখায়। Dash manual bKash/Nagad/Rocket/Bank payment verification flow ব্যবহার করে।",
        useCase: [
          "বর্তমান plan name, status, trial remaining, next billing date এবং billing cycle দেখতে।",
          "Products, Orders, Staff, Stores, Storage এবং AI Usage progress বুঝতে।",
          "Upgrade করার আগে limit ও feature compare করতে।"
        ],
        steps: [
          "Dashboard > Billing খুলুন।",
          "Current Plan card-এ plan status দেখুন।",
          "Usage card-এ current usage এবং plan limit দেখুন।",
          "Upgrade Plan card-এ monthly/yearly cycle switch করে plans compare করুন।",
          "Manual Payment section থেকে payment submit করতে পারেন।"
        ],
        important: [
          "New store Starter plan trial subscription পেতে পারে যদি plan configured থাকে।",
          "Usage limit helper আছে; সব জায়গায় enforcement পুরোপুরি চালু নাও হতে পারে।",
          "Payment approval না হওয়া পর্যন্ত subscription pending/past due থাকতে পারে।"
        ],
        tips: [
          "Trial শেষ হওয়ার আগে billing page দেখুন।",
          "Plan upgrade করার আগে product/order usage হিসাব করুন।"
        ],
        commonMistakes: [
          "Manual payment submit করলেই subscription instantly active হবে ভাবা।",
          "Usage bar-কে exact billing invoice মনে করা।"
        ],
        related: ["Upgrade Plan", "Submit Manual Payment", "Billing History"]
      }),
      page({
        slug: "billing/upgrade",
        title: "Upgrade Plan",
        intro:
          "Upgrade Plan section থেকে active plans দেখা যায়। Starter, Growth, Pro plan monthly বা yearly billing cycle দিয়ে select করা যায়।",
        useCase: [
          "Product/order/staff/store limit বাড়াতে।",
          "AI বা custom domain enabled plan বেছে নিতে।",
          "Yearly billing amount compare করতে।"
        ],
        steps: [
          "Billing page-এ Upgrade Plan section খুলুন।",
          "Monthly অথবা Yearly toggle নির্বাচন করুন।",
          "Plan card select করুন।",
          "Payable Amount readonly display দেখে payment করুন।",
          "Manual Payment form submit করুন।"
        ],
        important: [
          "Payable amount seller manually type করে না; server selected plan+cycle থেকে calculate করে।",
          "Client amount trust করা হয় না।",
          "Plan activation payment approval-এর পর।"
        ],
        tips: [
          "Yearly price annual budgetের সাথে মিলিয়ে দেখুন।",
          "Featured plan থাকলে সেটি সাধারণত recommended plan হিসেবে দেখায়।"
        ],
        commonMistakes: [
          "Plan select না করে payment transaction submit করা।",
          "Wrong cycle select করে yearly/monthly amount confusion তৈরি করা।"
        ],
        related: ["Submit Manual Payment", "Current Plan", "Subscription Settings"]
      }),
      page({
        slug: "billing/submit-manual-payment",
        title: "Submit Manual Payment",
        intro:
          "Manual subscription payment flow-তে seller bKash, Nagad, Rocket বা Bank Transfer দিয়ে pay করে transaction ID, sender number এবং note submit করে।",
        useCase: [
          "Gateway ছাড়া subscription payment জমা দিতে।",
          "Payment verification pending status tracking করতে।",
          "Billing history-তে payment record রাখতে।"
        ],
        steps: [
          "Billing page থেকে plan এবং billing cycle নির্বাচন করুন।",
          "Manual Payment section-এ payment account/instructions পড়ুন।",
          "Payment Method নির্বাচন করুন।",
          "Transaction ID, Sender Number এবং optional note দিন।",
          "Submit Payment for Verification চাপুন; success message দেখলে history refresh হবে।"
        ],
        important: [
          "Amount readonly; typed amount validation নেই।",
          "Server expected amount calculate করে payment record save করে।",
          "Status Pending থাকবে যতক্ষণ Dash team/admin verify না করে।"
        ],
        tips: [
          "Transaction ID copy-paste করলে ভুল কম হয়।",
          "Sender Number payment app-এর নম্বরের সাথে মিলিয়ে দিন।"
        ],
        commonMistakes: [
          "Payment করে form submit না করা।",
          "Wrong transaction ID দিলে approval delay হওয়া।"
        ],
        related: ["Billing History", "Invoices", "Upgrade Plan"]
      }),
      page({
        slug: "billing/history",
        title: "Billing History",
        intro:
          "Billing History subscription payment submissions দেখায়। Invoice number, method, amount, status এবং date দিয়ে pending/paid/failed payment track করা যায়।",
        useCase: [
          "Payment submitted হয়েছে কিনা নিশ্চিত করতে।",
          "Pending verification status দেখতে।",
          "Past subscription payments review করতে।"
        ],
        steps: [
          "Dashboard > Billing খুলুন।",
          "Billing History card-এ scroll করুন।",
          "Invoice, Method, Amount, Status এবং Date দেখুন।",
          "Pending থাকলে verification-এর জন্য অপেক্ষা করুন।",
          "Failed হলে payment details আবার check করে support-এ যোগাযোগ করুন।"
        ],
        important: [
          "History refresh সফল submit-এর পরে automatic হওয়া উচিত।",
          "Paid status approval-এর পরে আসে।",
          "Rejected/Failed payment subscription active করে না।"
        ],
        tips: [
          "Payment screenshot ভবিষ্যতের support communication-এর জন্য রেখে দিন।",
          "একই transaction ID বারবার submit করবেন না।"
        ],
        commonMistakes: [
          "Pending দেখে আবার একই payment submit করা।",
          "Invoice number না লিখে support ticket করা।"
        ],
        related: ["Submit Manual Payment", "Invoices", "Contact Support"]
      }),
      page({
        slug: "billing/invoices",
        title: "Invoices",
        intro:
          "Invoices card subscription payment invoice records দেখায়। View/Print action placeholder হিসেবে থাকে, আর future PDF download support-এর জন্য structure প্রস্তুত।",
        useCase: [
          "Subscription invoice number ও amount দেখতে।",
          "Payment status অনুযায়ী invoice বুঝতে।",
          "Print বা download placeholder থেকে future invoice workflow পরিকল্পনা করতে।"
        ],
        steps: [
          "Billing page-এ Invoices section দেখুন।",
          "Invoice number, method, amount, status এবং date review করুন।",
          "View / Print action থাকলে খুলে দেখুন।",
          "Paid invoice bookkeeping-এর জন্য note করুন।"
        ],
        important: [
          "PDF generation এখনো full feature নাও হতে পারে।",
          "Invoice paid status payment approval-এর উপর নির্ভর করে।",
          "Store sales invoice এবং subscription billing invoice আলাদা concept।"
        ],
        tips: [
          "Billing support লাগলে invoice number দিন।",
          "Subscription invoice আর customer order invoice মিশিয়ে ফেলবেন না।"
        ],
        commonMistakes: [
          "Customer order invoice settings দিয়ে subscription invoice বদলানোর চেষ্টা করা।",
          "Pending invoice-কে paid ধরে হিসাব করা।"
        ],
        related: ["Billing History", "Invoice Settings", "Current Plan"]
      }),
      page({
        slug: "billing/subscription-settings",
        title: "Subscription Settings",
        intro:
          "Subscription Settings section subscription renewal ও manual billing note দেখায়। Dash বর্তমানে manual billing verification model ব্যবহার করে, auto-renewal শুধুমাত্র tracking indicator হতে পারে।",
        useCase: [
          "Cancel at period end বা auto renewal status বুঝতে।",
          "Manual billing rules পড়তে।",
          "Subscription past due/expired হলে কী হবে তা জানতে।"
        ],
        steps: [
          "Billing page-এর Subscription Settings card খুলুন।",
          "Current status এবং renewal note পড়ুন।",
          "Subscription expired হলে নতুন payment submit করুন।",
          "Billing issue হলে support-এ invoice/payment reference দিন।"
        ],
        important: [
          "Expired subscription data delete করে না।",
          "Approval ছাড়া subscription active হয় না।",
          "Feature limit helpers আছে: canCreateProduct, canUseAI, canUseCustomDomain।"
        ],
        tips: [
          "Next billing date আগে reminder রাখুন।",
          "Plan limit কাছে পৌঁছালে Growth বা Pro consider করুন।"
        ],
        commonMistakes: [
          "Auto renewal on দেখে payment automatically কেটে যাবে ভাবা।",
          "Expired হলে store data হারিয়ে যাবে ভেবে panic করা।"
        ],
        related: ["Current Plan", "Upgrade Plan", "Submit Manual Payment"]
      })
    ]
  },
  {
    title: "স্টোরফ্রন্ট",
    pages: [
      page({
        slug: "storefront",
        title: "Storefront Overview",
        intro:
          "Storefront হলো customer-facing public ecommerce website। Default theme header, announcement bar, footer, homepage, shop, product details, cart, checkout এবং thank-you flow support করে।",
        useCase: [
          "Customer-কে store browse ও order place করতে।",
          "Theme settings দিয়ে logo, colors, hero, announcement ও contact info apply করতে।",
          "Local /s/{storeSlug} এবং production wildcard subdomain support করতে।"
        ],
        steps: [
          "/s/{storeSlug} খুলুন।",
          "Header, announcement bar, logo/store name এবং navigation দেখুন।",
          "Featured categories/products, trust badges এবং newsletter section দেখুন।",
          "Footer contact/social links settings অনুযায়ী আছে কিনা দেখুন।",
          "Shop/product/cart/checkout flow test করুন।"
        ],
        important: [
          "Storefront layout dashboard/admin থেকে isolated।",
          "Theme engine missing settings পেলে default fallback ব্যবহার করে।",
          "Products active/public না হলে public grid empty হবে।"
        ],
        tips: [
          "প্রতিটি major setting change-এর পরে storefront refresh করুন।",
          "Mobile menu test করুন।"
        ],
        commonMistakes: [
          "Dashboard product listে product দেখে storefront-এও দেখাবে ধরে নেয়া।",
          "Announcement text খুব বড় রাখা।"
        ],
        related: ["Shop Page", "Product Page", "Checkout"]
      }),
      page({
        slug: "storefront/shop",
        title: "Shop Page",
        intro:
          "Shop page active/public products grid দেখায়। Customer category filter এবং sort দিয়ে product browse করতে পারে।",
        useCase: [
          "সব live product এক জায়গায় দেখাতে।",
          "Category filter দিয়ে customer browsing সহজ করতে।",
          "Newest, price low to high এবং price high to low sort দিতে।"
        ],
        steps: [
          "/s/{storeSlug}/products খুলুন।",
          "All categories বা specific category নির্বাচন করুন।",
          "Sort dropdown থেকে newest/price order নির্বাচন করুন।",
          "Product card থেকে product details খুলুন।",
          "Product না থাকলে empty state দেখুন এবং dashboard থেকে product status check করুন।"
        ],
        important: [
          "Only ACTIVE + PUBLIC products show হয়।",
          "Category filter store-scoped।",
          "Product image না থাকলে fallback card design থাকতে পারে।"
        ],
        tips: [
          "প্রতি category-তে অন্তত কিছু product রাখলে shop page balanced দেখায়।",
          "Compare price দিলে sale card বেশি attractive হয়।"
        ],
        commonMistakes: [
          "Draft product shop page-এ খোঁজা।",
          "Category বানিয়ে product assign না করা।"
        ],
        related: ["Categories", "Product Page", "Search Page"]
      }),
      page({
        slug: "storefront/category-page",
        title: "Category Page",
        intro:
          "Category/collection page নির্দিষ্ট category-এর product দেখায়। এটি customer-কে একই ধরনের product একসাথে browse করতে সাহায্য করে।",
        useCase: [
          "Shoes, Bags, Accessories-এর মতো collection page তৈরি করতে।",
          "Homepage featured categories থেকে linked browsing দিতে।",
          "Category-specific empty state দেখাতে।"
        ],
        steps: [
          "Category slug দিয়ে /categories/{slug} route খুলুন।",
          "Category name ও product grid দেখুন।",
          "Product না থাকলে dashboard থেকে category assignment দেখুন।",
          "Product card থেকে details page খুলুন।"
        ],
        important: [
          "Category slug ভুল হলে clean 404/empty state হতে পারে।",
          "Only active/public product count হয়।",
          "Parent category relationship future browsing structure-এ কাজে লাগতে পারে।"
        ],
        tips: [
          "Homepage category cards থেকে popular category link করুন।",
          "Category name customer language অনুযায়ী রাখুন।"
        ],
        commonMistakes: [
          "Category exists মানেই product আছে ধরে নেয়া।",
          "Slug manually change করে old link ব্যবহার করা।"
        ],
        related: ["Categories", "Shop Page", "Product Status"]
      }),
      page({
        slug: "storefront/search",
        title: "Search Page",
        intro:
          "Search page product title এবং SKU দিয়ে product খুঁজতে সাহায্য করে। Customer search query দিয়ে matching active/public products দেখতে পারে।",
        useCase: [
          "Customer দ্রুত product খুঁজতে।",
          "SKU জানা থাকলে exact item খুঁজতে।",
          "No results empty state দিয়ে user-কে clean feedback দিতে।"
        ],
        steps: [
          "/s/{storeSlug}/search?q=shirt-এর মতো query দিন।",
          "Search result grid দেখুন।",
          "Product card খুলে details দেখুন।",
          "Result না থাকলে keyword ছোট করে চেষ্টা করুন।"
        ],
        important: [
          "Search only public visible products-এ কাজ করে।",
          "Archived/hidden product search result-এ আসবে না।",
          "Advanced search ranking এখনো simple foundation।"
        ],
        tips: [
          "Product title-এ customer যে শব্দ ব্যবহার করে সেটি রাখুন।",
          "SKU consistent হলে internal/customer search সহজ হয়।"
        ],
        commonMistakes: [
          "Description keyword দিয়ে search expect করা যদি search title/SKU scoped থাকে।",
          "Hidden product search result-এ না আসা দেখে error ভাবা।"
        ],
        related: ["Shop Page", "Add Product", "Product Page"]
      }),
      page({
        slug: "storefront/product-page",
        title: "Product Page",
        intro:
          "Product details page product gallery, title, SKU, category, price, compare price, stock status, short description, quantity selector এবং add-to-cart controls দেখায়।",
        useCase: [
          "Customer-কে product সম্পর্কে বিস্তারিত দেখাতে।",
          "Sale price, stock এবং SKU visibility দিতে।",
          "Related products দেখাতে।"
        ],
        steps: [
          "Shop page থেকে product খুলুন।",
          "Gallery thumbnail ও main image দেখুন।",
          "Quantity selector দিয়ে quantity নির্বাচন করুন।",
          "Add to Cart চাপুন।",
          "Description, Specifications, Reviews, Shipping & Returns tabs দেখুন।"
        ],
        important: [
          "Out of stock হলে purchase buttons disabled হতে পারে।",
          "Buy Now, Wishlist, Share placeholders UI-only হতে পারে।",
          "Related products same category/brand ভিত্তিতে আসতে পারে।"
        ],
        tips: [
          "Product photo ও short description পরিষ্কার রাখুন।",
          "Stock status accurate রাখতে inventory update করুন।"
        ],
        commonMistakes: [
          "Draft/hidden product direct URL দিয়ে public page খুলতে চাওয়া।",
          "SKU না দিলে product info অসম্পূর্ণ মনে হওয়া।"
        ],
        related: ["Add Product", "Cart", "Shop Page"]
      }),
      page({
        slug: "storefront/cart",
        title: "Cart",
        intro:
          "Cart store-scoped customer basket। Customer product add করলে title, price, image snapshot, quantity এবং line total browser storage/cookie/session strategy অনুযায়ী থাকে।",
        useCase: [
          "Checkout-এর আগে selected products review করতে।",
          "Quantity update বা item remove করতে।",
          "Subtotal দেখে checkout শুরু করতে।"
        ],
        steps: [
          "Product page থেকে Add to Cart করুন।",
          "/s/{storeSlug}/cart খুলুন।",
          "Quantity controls দিয়ে item quantity update করুন।",
          "Remove action দিয়ে item সরান।",
          "Checkout button চাপুন।"
        ],
        important: [
          "Cart store-scoped, store A-এর cart store B-তে mix হবে না।",
          "Add to cart only ACTIVE + PUBLIC product allow করে।",
          "Quantity stockQuantity ছাড়ালে validation হতে পারে।"
        ],
        tips: [
          "Customer confusion কমাতে product title ও image ঠিক রাখুন।",
          "Stock limit থাকলে checkout-এর আগে quantity test করুন।"
        ],
        commonMistakes: [
          "Archived product cart-এ add হবে ভাবা।",
          "এক store-এর cart অন্য store route-এ খোঁজা।"
        ],
        related: ["Product Page", "Checkout", "Payment Methods"]
      }),
      page({
        slug: "storefront/checkout",
        title: "Checkout",
        intro:
          "Checkout page customer info, shipping address, shipping rate, payment method, payment reference/note এবং order summary নিয়ে order তৈরি করে।",
        useCase: [
          "Customer order place করতে।",
          "Enabled shipping rates এবং payment methods দেখাতে।",
          "Manual mobile payment transaction ID collect করতে।"
        ],
        steps: [
          "Cart থেকে Checkout চাপুন।",
          "Customer name, email/phone এবং shipping address দিন।",
          "Shipping method/rate নির্বাচন করুন।",
          "Payment method নির্বাচন করুন।",
          "Manual bKash/Nagad/Rocket হলে transaction/reference ID দিন, তারপর Place Order চাপুন।"
        ],
        important: [
          "Order total server-side cart items, selected shipping rate এবং payment settings থেকে calculate হয়।",
          "Shipping amount client-submitted value থেকে trust করা হয় না।",
          "Order created হলে Thank You page-এ redirect হয়।"
        ],
        tips: [
          "Payment instructions checkout-এ সংক্ষিপ্ত ও পরিষ্কার রাখুন।",
          "Phone field customer delivery confirmation-এর জন্য গুরুত্বপূর্ণ।"
        ],
        commonMistakes: [
          "Enabled payment/shipping না রেখেই checkout test করা।",
          "Manual payment reference না দিয়ে mobile payment order place করতে চাওয়া।"
        ],
        related: ["Shipping Zones", "Payment Methods", "Thank You Page"]
      }),
      page({
        slug: "storefront/thank-you",
        title: "Thank You Page",
        intro:
          "Thank You page checkout সফল হওয়ার পরে order confirmation দেখায়। এখানে order number, order summary, selected payment method এবং relevant instructions দেখা যায়।",
        useCase: [
          "Customer-কে order সফল হয়েছে জানাতে।",
          "Order number future support-এর জন্য দিতে।",
          "Continue shopping button দিয়ে storefront-এ ফিরিয়ে নিতে।"
        ],
        steps: [
          "Checkout complete করুন।",
          "/thank-you/{orderNumber} page খুলবে।",
          "Order number এবং summary দেখুন।",
          "Manual payment হলে instruction/reference status পড়ুন।",
          "Continue shopping দিয়ে storefront-এ ফিরুন।"
        ],
        important: [
          "Thank You page order create হওয়ার confirmation, payment final approval নয়।",
          "Manual payment pending থাকতে পারে।",
          "Unknown order number হলে clean not found behavior হতে পারে।"
        ],
        tips: [
          "Customer support request এলে order number চাইুন।",
          "Payment instruction thank-you page-এও পরিষ্কার রাখুন।"
        ],
        commonMistakes: [
          "Thank You দেখেই payment paid ধরে নেয়া।",
          "Order number screenshot না রেখে customer support করা।"
        ],
        related: ["Checkout", "Manage Orders", "Manual bKash/Nagad/Rocket Payments"]
      }),
      page({
        slug: "storefront/customer-account",
        title: "Customer Account",
        intro:
          "Customer Account route storefront architecture-এর future-ready অংশ। Customer self-service order tracking/account feature পুরোপুরি চালু না থাকলে এটি placeholder/foundation হিসেবে থাকবে।",
        useCase: [
          "ভবিষ্যতে customer login/account area প্রস্তুত রাখতে।",
          "Order history, addresses এবং profile settings-এর জায়গা পরিকল্পনা করতে।",
          "Storefront navigation-এ account icon destination রাখতে।"
        ],
        steps: [
          "Storefront header-এর account icon দেখুন।",
          "/s/{storeSlug}/account route খুলুন।",
          "Placeholder বা available account content review করুন।",
          "Customer-facing support information প্রস্তুত রাখুন।"
        ],
        important: [
          "Seller dashboard login এবং customer account এক জিনিস নয়।",
          "Customer account full auth/portal চালু না থাকলে order tracking manual/support-based থাকবে।",
          "Storefront architecture future account pages support করে।"
        ],
        tips: [
          "Customer account চালু হওয়ার আগে Thank You page ও support contact পরিষ্কার রাখুন।",
          "Footer support links update রাখুন।"
        ],
        commonMistakes: [
          "Seller /dashboard login customer-কে দেয়া।",
          "Account icon দেখেই customer portal complete ধরে নেয়া।"
        ],
        related: ["Thank You Page", "Checkout", "Storefront Overview"]
      })
    ]
  },
  {
    title: "সাহায্য",
    pages: [
      page({
        slug: "help/faq",
        title: "FAQ",
        intro:
          "FAQ পেজে Dash Commerce OS ব্যবহার নিয়ে সাধারণ প্রশ্নের সংক্ষিপ্ত উত্তর থাকবে। এটি নতুন seller-দের setup, payment, shipping, product এবং billing confusion কমানোর জন্য।",
        useCase: [
          "প্রথমবার dashboard ব্যবহার করার সময় দ্রুত উত্তর পেতে।",
          "Storefront-এ product কেন দেখা যাচ্ছে না, payment pending কেন, billing approval কীভাবে হয় এসব জানতে।",
          "Support-এ যাওয়ার আগে common issue নিজে solve করতে।"
        ],
        steps: [
          "Docs > Help > FAQ খুলুন।",
          "আপনার প্রশ্নের কাছাকাছি topic খুঁজুন।",
          "Related page খুলে বিস্তারিত ধাপ পড়ুন।",
          "সমাধান না হলে Contact Support page অনুসরণ করুন।"
        ],
        important: [
          "FAQ support ticket-এর বিকল্প নয়, quick guidance।",
          "Feature availability plan/subscription/configuration অনুযায়ী ভিন্ন হতে পারে।",
          "Admin/internal panel FAQ-তে রাখা হয়নি।"
        ],
        tips: [
          "সবচেয়ে বেশি issue হয় product status/visibility, payment method enabled না থাকা, shipping rate disabled থাকা।",
          "প্রশ্ন লিখে রাখলে support-এ দ্রুত সাহায্য পাওয়া যায়।"
        ],
        commonMistakes: [
          "FAQ-তে না পেলে feature নেই ধরে নেয়া।",
          "একই issue বিভিন্ন page-এ খুঁজে সময় নষ্ট করা।"
        ],
        related: ["Troubleshooting", "Contact Support", "Complete Store Setup"]
      }),
      page({
        slug: "help/troubleshooting",
        title: "Troubleshooting",
        intro:
          "Troubleshooting guide সাধারণ সমস্যা দ্রুত পরীক্ষা করার checklist। Product missing, checkout issue, payment pending, Google login, media upload বা billing submission issue এখানে diagnose করা যায়।",
        useCase: [
          "Storefront খালি দেখালে কী check করবেন।",
          "Checkout payment/shipping option না দেখালে কী করবেন।",
          "Manual billing payment submit করার পর status কোথায় দেখবেন।"
        ],
        steps: [
          "সমস্যা কোন module-এ হচ্ছে তা ঠিক করুন।",
          "Product issue হলে status ACTIVE এবং visibility PUBLIC কিনা দেখুন।",
          "Checkout issue হলে Settings > Payments এবং Shipping enabled কিনা দেখুন।",
          "Billing issue হলে Billing History-তে pending/failed status দেখুন।",
          "Login issue হলে email/password বা Google configuration আলাদা করে test করুন।"
        ],
        important: [
          "Database schema change হয়েছে কিন্তু migration/push না হলে Prisma runtime error হতে পারে।",
          "Decimal object client component-এ পাঠালে serialization error হতে পারে; seller হিসেবে page refresh/support লাগতে পারে।",
          "Environment variable missing হলে StoreOS/Google/Billing settings কাজ নাও করতে পারে।"
        ],
        tips: [
          "Error screenshot, URL এবং সময় support-কে দিলে দ্রুত diagnosis হয়।",
          "একবারে একটি setting বদলে test করুন।"
        ],
        commonMistakes: [
          "Runtime error দেখেও database migration না করা।",
          "Wrong store slug খুলে product খোঁজা।"
        ],
        related: ["Contact Support", "Storefront Setup", "Submit Manual Payment"]
      }),
      page({
        slug: "help/contact-support",
        title: "Contact Support",
        intro:
          "Contact Support page seller-কে support request করার আগে কী তথ্য প্রস্তুত রাখতে হবে তা বলে। এতে issue দ্রুত বুঝে সমাধান করা সহজ হয়।",
        useCase: [
          "Login, billing, order, payment, shipping বা storefront issue report করতে।",
          "Manual subscription payment verification নিয়ে follow-up করতে।",
          "Technical error screenshot পাঠাতে।"
        ],
        steps: [
          "সমস্যার module name লিখুন, যেমন Products বা Billing।",
          "Store slug, account email এবং affected order/payment/invoice number দিন।",
          "Screenshot বা exact error message দিন।",
          "কী action করার পরে সমস্যা হয়েছে সেটি লিখুন।",
          "Urgent হলে phone/WhatsApp contact detail দিন।"
        ],
        important: [
          "Password, API key বা payment secret support message-এ লিখবেন না।",
          "Manual payment verification-এর জন্য transaction ID এবং sender number দরকার হতে পারে।",
          "Admin Console documentation public docs-এ নেই।"
        ],
        tips: [
          "একটি ticket/message-এ একটি issue রাখলে দ্রুত সমাধান হয়।",
          "Browser, device এবং URL লিখলে UI issue বুঝতে সুবিধা হয়।"
        ],
        commonMistakes: [
          "শুধু 'কাজ করছে না' লিখে context না দেয়া।",
          "Secret credential screenshot পাঠানো।"
        ],
        related: ["Troubleshooting", "Billing History", "FAQ"]
      }),
      page({
        slug: "help/changelog",
        title: "Changelog",
        intro:
          "Changelog seller-facing update বুঝতে সাহায্য করে। নতুন module, UI change, billing rule, storefront update বা bug fix এখানে সংক্ষেপে রাখা যেতে পারে।",
        useCase: [
          "নতুন feature কখন এসেছে জানতে।",
          "Dashboard UI পরিবর্তনের কারণ বুঝতে।",
          "নিজের workflow-এ কোনো পরিবর্তন দরকার কিনা বুঝতে।"
        ],
        steps: [
          "Docs > Help > Changelog খুলুন।",
          "সাম্প্রতিক update section দেখুন।",
          "যে module বদলেছে তার related docs পড়ুন।",
          "Feature এখনও foundation হলে limitation note পড়ুন।"
        ],
        important: [
          "Changelog official release note নয় যদি product team আলাদা release note প্রকাশ করে।",
          "Feature rollout store/plan অনুযায়ী আলাদা হতে পারে।",
          "Breaking change হলে related page update করা উচিত।"
        ],
        tips: [
          "নতুন dashboard action দেখলে changelog ও docs একসাথে দেখুন।",
          "Team member থাকলে important changes share করুন।"
        ],
        commonMistakes: [
          "Changelog না পড়ে পুরোনো workflow ধরে কাজ করা।",
          "Foundation feature-কে production-ready ধরে নেয়া।"
        ],
        related: ["FAQ", "Dashboard Overview", "Reports"]
      }),
      page({
        slug: "profile",
        title: "Profile ও Account Settings",
        intro:
          "Profile page seller account-এর personal information, security, preferences এবং connected accounts দেখায়। Topbar avatar dropdown থেকে Profile, Account Settings এবং Logout পাওয়া যায়।",
        useCase: [
          "Full name, avatar URL, phone এবং preferences update করতে।",
          "Credentials user হলে password change করতে।",
          "Google account connected কিনা এবং email login enabled কিনা দেখতে।"
        ],
        steps: [
          "Topbar avatar dropdown খুলুন।",
          "Profile নির্বাচন করুন।",
          "Personal Information card থেকে name, avatar URL এবং phone update করুন।",
          "Preferences card থেকে language, timezone এবং date format set করুন।",
          "Credentials account হলে Account Security থেকে password change করুন।"
        ],
        important: [
          "Email readonly হতে পারে যদি email change flow enabled না থাকে।",
          "Google-only user password change unavailable message দেখতে পারে।",
          "Timezone report/date display-এর জন্য গুরুত্বপূর্ণ।"
        ],
        tips: [
          "Bangladesh business হলে Asia/Dhaka timezone রাখুন।",
          "Avatar URL public image হলে ভালো।"
        ],
        commonMistakes: [
          "Email field edit করতে না পেরে bug ভাবা।",
          "Google account-এ password change করার চেষ্টা করা।"
        ],
        related: ["লগইন", "Dashboard Overview", "Contact Support"]
      })
    ]
  }
];

export const docsSections: DocsSection[] = docsInput.map((section) => ({
  title: section.title,
  pages: section.pages.map((pageItem) => ({
    ...pageItem,
    category: section.title
  }))
}));

export const docsPages = docsSections.flatMap((section) => section.pages);

export const firstDocsPage = docsPages[0]!;

export function getDocsPage(slug?: string) {
  if (!slug) {
    return firstDocsPage;
  }

  return docsPages.find((pageItem) => pageItem.slug === slug) ?? null;
}

export function getDocsPageNeighbors(slug: string) {
  const index = docsPages.findIndex((pageItem) => pageItem.slug === slug);

  return {
    next: index >= 0 ? (docsPages[index + 1] ?? null) : null,
    previous: index > 0 ? (docsPages[index - 1] ?? null) : null
  };
}

function page(input: PageInput): PageInput {
  return input;
}
