package com.msoa.catalog.service;

import com.msoa.catalog.dto.CreateProductRequest;
import com.msoa.catalog.dto.UpdateProductRequest;
import com.msoa.catalog.model.Product;
import com.msoa.catalog.repository.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.List;

@Service
public class ProductService {

    private final ProductRepository repository;

    public ProductService(ProductRepository repository) {
        this.repository = repository;
    }

    public List<Product> getAllProducts() {
        return repository.findAll();
    }

    public List<Product> getAllProducts(String search, String category,
                                        BigDecimal minPrice, BigDecimal maxPrice,
                                        String sort, String direction) {
        if ((minPrice != null && minPrice.signum() < 0)
                || (maxPrice != null && maxPrice.signum() < 0)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Prices must be greater than or equal to zero");
        }
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "minPrice must be less than or equal to maxPrice");
        }
        if (sort != null && !sort.equals("name") && !sort.equals("price")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "sort must be name or price");
        }
        if (direction != null && !direction.equals("asc") && !direction.equals("desc")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "direction must be asc or desc");
        }
        if (direction != null && sort == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "direction requires sort");
        }

        String normalizedSearch = search == null || search.isBlank() ? null : search.strip();
        String normalizedCategory = category == null || category.isBlank() ? null : category.strip();
        return repository.findAll(normalizedSearch, normalizedCategory, minPrice, maxPrice,
                sort, direction == null ? "asc" : direction);
    }

    public Product createProduct(CreateProductRequest request) {
        return repository.save(
                request.name(),
                request.category(),
                request.price(),
                request.image() == null ? "" : request.image(),
                request.description() == null ? "" : request.description()
        );
    }

    public Product updateProduct(Long id, UpdateProductRequest request) {
        getProductById(id);
        if (repository.update(id, request) == 0) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Product not found: " + id);
        }
        return getProductById(id);
    }

    public void deleteProduct(Long id) {
        if (repository.deleteById(id) == 0) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Product not found: " + id);
        }
    }

    public Product getProductById(Long id) {
        return repository.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Product not found: " + id
                        ));
    }
}
