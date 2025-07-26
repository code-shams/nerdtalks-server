# Nerdtalks Server - Backend API

The robust backend API powering Nerdtalks, a modern community forum platform. This RESTful API handles user authentication, content management, payment processing, and administrative operations for the Nerdtalks community.

## 🌐 Live API

- **Production URL**: [https://nerdtalks-server.vercel.app/](https://nerdtalks-server.vercel.app/)
- **Frontend Application**: [https://nerdtalks-sh.web.app/](https://nerdtalks-sh.web.app/)

## 🛠️ Tech Stack

### Core Technologies
- **Node.js** - JavaScript runtime environment
- **Express.js** - Fast, unopinionated web framework
- **MongoDB** - NoSQL database for flexible data storage

### Authentication & Security
- **Firebase Admin SDK** - Server-side authentication verification
- **JWT Tokens** - Secure token-based authentication
- **CORS** - Cross-origin resource sharing middleware

### Payment Processing
- **Stripe** - Secure payment gateway for membership subscriptions

### Deployment
- **Vercel** - Serverless deployment platform

## 🏗️ Architecture

### Database Collections
- **users** - User profiles, roles, and badges
- **posts** - Forum posts with voting and metadata
- **comments** - Post comments and replies
- **tags** - Content categorization system
- **announcements** - Admin announcements and notifications
- **reports** - Content moderation and reporting system

### Authentication Flow
1. Client sends Firebase ID token in Authorization header
2. Server verifies token using Firebase Admin SDK
3. Decoded user information attached to request object
4. Protected routes accessible with valid authentication

## 🚀 API Endpoints

### Authentication
All protected routes require `Authorization: Bearer <firebase-token>` header.

### User Management
```
GET    /users/:uid              # Get user by Firebase UID
GET    /users                   # Get all users (admin, paginated)
POST   /users                   # Create/update user profile
PATCH  /users/:uid/badges       # Add badge to user
PATCH  /users/:id/make-admin    # Promote user to admin
```

### Posts & Content
```
GET    /posts                   # Get all posts (paginated, filterable)
GET    /post/:id                # Get single post by ID
GET    /posts/user/:authorId    # Get user's posts (dashboard)
POST   /posts                   # Create new post
PATCH  /posts/:postId/vote      # Vote on post (up/down)
DELETE /posts/:id               # Delete post
```

### Comments System
```
GET    /comments/:postId        # Get comments for a post
GET    /comments/post/:postId   # Get paginated comments (dashboard)
POST   /comments               # Create new comment
DELETE /comments/:id           # Delete comment (admin)
```

### Content Moderation
```
GET    /reports                # Get all reports (admin, paginated)
POST   /reports/comment        # Report a comment
PATCH  /reports/:id/status     # Update report status (admin)
DELETE /reports/:id/delete     # Delete report (admin)
```

### Tags & Categories
```
GET    /tags                   # Get all available tags
POST   /tags                   # Create new tag (admin)
```

### Announcements
```
GET    /announcements          # Get all announcements
POST   /announcements          # Create announcement (admin)
```

### Admin Dashboard
```
GET    /admin/stats            # Get platform statistics (admin)
```

### Payment Processing
```
POST   /create-payment-intent  # Create Stripe payment intent
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB database
- Firebase project with Admin SDK
- Stripe account for payments

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nerdtalks-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   # Database
   MONGODB_URI=your_mongodb_connection_string
   
   # Firebase Admin
   FB_SECRET=your_firebase_admin_private_key
   
   # Payment Processing
   STRIPE_SECRET_KEY=your_stripe_secret_key
   
   # Server Configuration
   PORT=3000
   ```

4. **Firebase Admin Setup**
   - Create a `decrypter.js` file that exports your Firebase service account credentials
   - Ensure proper security for Firebase private keys

5. **Start the development server**
   ```bash
   npm start
   ```

6. **Test the API**
   ```bash
   npm run dev
   # Should return: "Nerds are talking"
   ```

## 📦 Dependencies

### Core Dependencies
```json
{
  "express": "Web application framework",
  "mongodb": "MongoDB driver for Node.js",
  "firebase-admin": "Firebase Admin SDK",
  "stripe": "Stripe payment processing",
  "cors": "Cross-origin resource sharing",
  "dotenv": "Environment variable management"
}
```

## 🔒 Security Features

### Authentication Middleware
- **Token Verification**: Every protected route validates Firebase ID tokens
- **Role-Based Access**: Admin-only endpoints with proper authorization
- **Request Validation**: Input sanitization and validation on all endpoints

### Data Protection
- **Environment Variables**: Sensitive credentials stored securely
- **CORS Configuration**: Controlled cross-origin access
- **Input Validation**: Comprehensive request body validation

## 📊 API Features

### Pagination
- **Configurable Limits**: Support for custom page sizes
- **Metadata**: Total counts, page information, and navigation flags
- **Performance**: Efficient database queries with skip/limit

### Search & Filtering
- **Tag-based Filtering**: Filter posts by content categories
- **Search Functionality**: Text search across user names and emails
- **Sorting Options**: Sort by popularity, date, or relevance

### Voting System
- **Dual Voting**: Support for both upvotes and downvotes
- **Vote Switching**: Users can change their vote type
- **Vote Removal**: Users can remove their votes
- **Popularity Calculation**: Dynamic popularity scoring

### Content Moderation
- **Report System**: Users can report inappropriate content
- **Admin Workflow**: Comprehensive tools for handling reports
- **Status Tracking**: Report lifecycle management
- **Bulk Operations**: Efficient batch processing for moderation

## 🚀 Deployment

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod
```

### Environment Variables Setup
Configure the following environment variables in your Vercel dashboard:
- `MONGODB_URI`
- `FB_SECRET`
- `STRIPE_SECRET_KEY`

## 📈 Performance Optimizations

- **Database Indexing**: Optimized queries with proper indexing
- **Aggregation Pipelines**: Efficient data processing for complex operations
- **Connection Pooling**: MongoDB connection optimization
- **Caching Strategy**: Reduced database load with smart caching

## 🧪 Testing

```bash
# Run development server
npm run dev

# Test specific endpoints
npm run test
```

## 📝 API Documentation

### Response Format
All API responses follow a consistent format:
```json
{
  "message": "Success message",
  "data": "Response data",
  "pagination": "Pagination info (when applicable)"
}
```

### Error Handling
Comprehensive error handling with appropriate HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (server issues)

## 🤝 Contributing

We welcome contributions! Please ensure all contributions include:
- Proper error handling
- Input validation
- Authentication middleware where needed
- Consistent code formatting


## 👨‍💻 Author

**Maksudur Rahman**
- GitHub: [@code-shams](https://github.com/code-shams)
- LinkedIn: [code-shams](https://linkedin.com/in/code-shams)
- Portfolio: [https://code-shams.vercel.app](https://code-shams.vercel.app)

---

*Powering the Nerdtalks community with robust, scalable backend infrastructure*