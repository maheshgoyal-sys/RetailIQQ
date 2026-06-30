from flask import Flask, request, jsonify
import math
import random

app = Flask(__name__)

# Fields that are categorical (text) and need one-hot encoding instead of normalization
CATEGORICAL_FIELDS = {'city', 'state'}

# Native pure Python K-Means clustering implementation (works for any number of dimensions)
def custom_kmeans(data, k, max_iters=100):
    """
    Pure Python K-Means clustering.
    data: list of feature vectors, each vector is a list of floats (any length/dimension)
    """
    if not data:
        return [], []

    dims = len(data[0])

    # 1. Initialize centroids randomly from points
    centroids = [list(p) for p in random.sample(data, min(k, len(data)))]
    while len(centroids) < k:
        centroids.append([0.0] * dims)  # Padding if fewer data points than k

    assignments = [0] * len(data)

    for _ in range(max_iters):
        # 2. Assign each point to the nearest centroid
        changed = False
        for i, point in enumerate(data):
            min_dist = float('inf')
            best_cluster = 0
            for cluster_idx, centroid in enumerate(centroids):
                dist = math.sqrt(sum((point[d] - centroid[d]) ** 2 for d in range(dims)))
                if dist < min_dist:
                    min_dist = dist
                    best_cluster = cluster_idx

            if assignments[i] != best_cluster:
                assignments[i] = best_cluster
                changed = True

        if not changed:
            break

        # 3. Recalculate centroids
        cluster_sums = [[0.0] * dims for _ in range(k)]
        cluster_counts = [0] * k

        for i, cluster_idx in enumerate(assignments):
            for d in range(dims):
                cluster_sums[cluster_idx][d] += data[i][d]
            cluster_counts[cluster_idx] += 1

        for c in range(k):
            if cluster_counts[c] > 0:
                centroids[c] = [cluster_sums[c][d] / cluster_counts[c] for d in range(dims)]

    return assignments, centroids


def build_feature_vectors(customers, feature_keys):
    """
    Builds normalized numeric feature vectors from raw customer dicts.
    - Numeric fields (total_spent, total_orders, average_order_value, last_order_amount,
      loyalty_points, etc.) are min-max normalized.
    - Categorical fields (city, state) are one-hot encoded based on the distinct values
      present in this batch of customers.
    Returns (vectors, cust_ids)
    """
    numeric_keys = [f for f in feature_keys if f not in CATEGORICAL_FIELDS]
    categorical_keys = [f for f in feature_keys if f in CATEGORICAL_FIELDS]

    cust_ids = [c.get('id') or c.get('customer_id') for c in customers]

    # --- Numeric feature extraction + min-max normalization ---
    raw_numeric = []
    for c in customers:
        row = [float(c.get(key, 0.0) or 0.0) for key in numeric_keys]
        raw_numeric.append(row)

    normalized_numeric = []
    if numeric_keys:
        mins = [min(row[i] for row in raw_numeric) for i in range(len(numeric_keys))]
        maxs = [max(row[i] for row in raw_numeric) for i in range(len(numeric_keys))]
        spans = [(maxs[i] - mins[i]) if (maxs[i] - mins[i]) > 0 else 1.0 for i in range(len(numeric_keys))]

        for row in raw_numeric:
            normalized_numeric.append([(row[i] - mins[i]) / spans[i] for i in range(len(numeric_keys))])
    else:
        normalized_numeric = [[] for _ in customers]

    # --- Categorical feature extraction + one-hot encoding ---
    categorical_encoded = [[] for _ in customers]
    for key in categorical_keys:
        # Collect distinct values for this field, preserving stable order
        distinct_values = sorted({str(c.get(key, 'Unknown') or 'Unknown') for c in customers})
        value_index = {val: idx for idx, val in enumerate(distinct_values)}

        for i, c in enumerate(customers):
            one_hot = [0.0] * len(distinct_values)
            val = str(c.get(key, 'Unknown') or 'Unknown')
            one_hot[value_index[val]] = 1.0
            categorical_encoded[i].extend(one_hot)

    # --- Combine numeric + categorical into final vectors ---
    vectors = [normalized_numeric[i] + categorical_encoded[i] for i in range(len(customers))]

    return vectors, cust_ids


@app.route('/ml/segment', methods=['POST'])
def segment_customers():
    """
    Expects JSON body:
    {
      "k": 5,
      "features": ["total_spent", "total_orders", "average_order_value", "city", "state"],
      "customers": [
        { "id": "1", "total_spent": 22400.0, "total_orders": 18, "average_order_value": 1244.4,
          "last_order_amount": 500.0, "loyalty_points": 320, "city": "Mumbai", "state": "MH" },
        ...
      ]
    }
    Returns mapping of: { "customer_id": "segment_label" }
    """
    try:
        payload = request.json
        if not payload:
            return jsonify({"error": "No data received"}), 400

        customers = payload.get('customers')
        feature_keys = payload.get('features')
        k_clusters = int(payload.get('k', 5))

        if not customers:
            return jsonify({"error": "No customer data received"}), 400
        if not feature_keys:
            return jsonify({"error": "No features selected"}), 400
        if k_clusters < 1:
            return jsonify({"error": "k must be at least 1"}), 400

        vectors, cust_ids = build_feature_vectors(customers, feature_keys)

        if not vectors or not vectors[0]:
            return jsonify({"error": "Failed to build feature vectors from selected features"}), 400

        if k_clusters > len(vectors):
            k_clusters = len(vectors)

        assignments, centroids = custom_kmeans(vectors, k_clusters)

        # Rank clusters by average vector magnitude (proxy for "value") to assign labels
        cluster_scores = []
        for c in range(k_clusters):
            c_points = [vectors[i] for i, ass in enumerate(assignments) if ass == c]
            if c_points:
                avg_score = sum(sum(p) for p in c_points) / len(c_points)
            else:
                avg_score = 0.0
            cluster_scores.append((c, avg_score))

        sorted_clusters = sorted(cluster_scores, key=lambda x: x[1], reverse=True)

        labels = [
            "High value loyal",
            "Regular buyers",
            "New customers",
            "At-risk customers",
            "Dormant",
        ]

        cluster_to_label = {}
        for rank, (c_idx, _) in enumerate(sorted_clusters):
            cluster_to_label[c_idx] = labels[rank] if rank < len(labels) else "At-risk customers"

        result = {}
        for i, cust_id in enumerate(cust_ids):
            cluster_assigned = assignments[i]
            result[cust_id] = cluster_to_label.get(cluster_assigned, "Regular buyers")

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "retailiq-ml"}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)