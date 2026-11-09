package com.msoa.catalog.repository;

import com.msoa.catalog.dto.UpdateProductRequest;
import com.msoa.catalog.model.Product;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Repository
public class ProductRepository {

    private final JdbcTemplate jdbcTemplate;

    public ProductRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Product> findAll() {
        return findAll(null, null, null, null, null, "asc");
    }

    public List<Product> findAll(String search, String category,
                                 BigDecimal minPrice, BigDecimal maxPrice,
                                 String sort, String direction) {
        StringBuilder sql = new StringBuilder("""
                SELECT id, name, category, price, image, description
                FROM products
                WHERE 1 = 1
                """);
        List<Object> parameters = new ArrayList<>();

        if (search != null) {
            // Escape LIKE metacharacters so search is a literal substring.
            String pattern = "%" + search.replace("!", "!!")
                    .replace("%", "!%").replace("_", "!_") + "%";
            sql.append(" AND (LOWER(name) LIKE LOWER(?) ESCAPE '!'")
                    .append(" OR LOWER(description) LIKE LOWER(?) ESCAPE '!')");
            parameters.add(pattern);
            parameters.add(pattern);
        }
        if (category != null) {
            sql.append(" AND category = ?");
            parameters.add(category);
        }
        if (minPrice != null) {
            sql.append(" AND price >= ?");
            parameters.add(minPrice);
        }
        if (maxPrice != null) {
            sql.append(" AND price <= ?");
            parameters.add(maxPrice);
        }

        // Only fixed SQL fragments from these allowlists may enter ORDER BY.
        String sortColumn;
        if (sort == null) {
            sortColumn = "id";
        } else {
            sortColumn = switch (sort) {
                case "name" -> "name COLLATE NOCASE";
                case "price" -> "price";
                default -> throw new IllegalArgumentException("Unsupported sort column");
            };
        }
        String sortDirection = switch (direction) {
            case "asc" -> "ASC";
            case "desc" -> "DESC";
            default -> throw new IllegalArgumentException("Unsupported sort direction");
        };
        sql.append(" ORDER BY ").append(sortColumn).append(" ").append(sortDirection);
        if (sort != null) {
            sql.append(", id ASC");
        }

        return jdbcTemplate.query(sql.toString(),
                (rs, rowNum) -> mapProduct(rs), parameters.toArray());
    }

    public Optional<Product> findById(Long id) {
        String sql = """
                SELECT id, name, category, price,
                       image, description
                FROM products
                WHERE id = ?
                """;

        return jdbcTemplate.query(sql,
                (rs, rowNum) -> mapProduct(rs), id)
                .stream()
                .findFirst();
    }

    public Product save(String name, String category, BigDecimal price,
                        String image, String description) {
        String sql = """
                INSERT INTO products (name, category, price, image, description)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id, name, category, price, image, description
                """;

        return jdbcTemplate.queryForObject(sql,
                (rs, rowNum) -> mapProduct(rs),
                name, category, price, image, description);
    }

    public int update(Long id, UpdateProductRequest request) {
        String sql = """
                UPDATE products
                SET name = ?,
                    category = ?,
                    price = ?,
                    image = ?,
                    description = ?
                WHERE id = ?
                """;

        return jdbcTemplate.update(sql,
                request.name(),
                request.category(),
                request.price(),
                request.image() == null ? "" : request.image(),
                request.description() == null ? "" : request.description(),
                id);
    }

    public int deleteById(Long id) {
        String sql = """
                DELETE FROM products
                WHERE id = ?
                """;

        return jdbcTemplate.update(sql, id);
    }

    private Product mapProduct(
            java.sql.ResultSet rs)
            throws java.sql.SQLException {

        return new Product(
                rs.getLong("id"),
                rs.getString("name"),
                rs.getString("category"),
                rs.getBigDecimal("price"),
                rs.getString("image"),
                rs.getString("description")
        );
    }
}
